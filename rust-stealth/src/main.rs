#![windows_subsystem = "windows"]

use std::env;
use std::ffi::c_void;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicIsize, Ordering};
use std::thread;
use std::time::Duration;

use tao::{
    dpi::LogicalSize,
    event::{Event, WindowEvent},
    event_loop::{ControlFlow, EventLoopBuilder},
    platform::windows::WindowExtWindows,
    window::WindowBuilder,
};
use wry::{NewWindowResponse, PermissionKind, PermissionResponse, WebContext, WebViewBuilder};

type HWND = *mut c_void;
type BOOL = i32;

const SW_HIDE: i32 = 0;
const SW_SHOW: i32 = 5;
const SW_RESTORE: i32 = 9;
const VK_ESCAPE: i32 = 0x1B;
const VK_Q: i32 = 0x51;
const VK_MENU: i32 = 0x12; // Alt key

#[link(name = "user32")]
extern "system" {
    fn ShowWindow(hWnd: HWND, nCmdShow: i32) -> BOOL;
    fn SetForegroundWindow(hWnd: HWND) -> BOOL;
    fn GetAsyncKeyState(vKey: i32) -> i16;
    fn GetForegroundWindow() -> HWND;
}

#[link(name = "shell32")]
extern "system" {
    fn ShellExecuteW(
        hwnd: HWND,
        lpOperation: *const u16,
        lpFile: *const u16,
        lpParameters: *const u16,
        lpDirectory: *const u16,
        nShowCmd: i32,
    ) -> isize;
}

fn open_external_url(url: &str) {
    if !url.starts_with("https://") && !url.starts_with("http://") {
        return;
    }
    let op: Vec<u16> = "open\0".encode_utf16().collect();
    let target: Vec<u16> = format!("{}\0", url).encode_utf16().collect();
    unsafe {
        ShellExecuteW(
            std::ptr::null_mut(),
            op.as_ptr(),
            target.as_ptr(),
            std::ptr::null(),
            std::ptr::null(),
            SW_SHOW,
        );
    }
}

#[derive(Debug)]
enum UserEvent {
    Minimize,
    Maximize,
    Close,
    Drag,
    ToggleMini,
    TogglePin,
    Navigate(String),
}

static APP_HWND: AtomicIsize = AtomicIsize::new(0);
static IS_HIDDEN: AtomicBool = AtomicBool::new(false);
static IS_RUNNING: AtomicBool = AtomicBool::new(true);

fn toggle_boss_key() {
    let hwnd = APP_HWND.load(Ordering::SeqCst) as HWND;
    if hwnd.is_null() {
        return;
    }
    unsafe {
        let hidden = IS_HIDDEN.load(Ordering::SeqCst);
        if !hidden {
            ShowWindow(hwnd, SW_HIDE);
            IS_HIDDEN.store(true, Ordering::SeqCst);
        } else {
            ShowWindow(hwnd, SW_SHOW);
            ShowWindow(hwnd, SW_RESTORE);
            SetForegroundWindow(hwnd);
            IS_HIDDEN.store(false, Ordering::SeqCst);
        }
    }
}

const STEALTH_INIT_SCRIPT: &str = r#"
(function() {
  if (window.__JOSJIS_STEALTH_INIT__) return;
  window.__JOSJIS_STEALTH_INIT__ = true;

  var ghostEnabled = false;
  var ghostAlpha = '0.14';
  var isMini = false;
  var isPinned = false;
  var cursorInside = true;

  function postIPC(payload) {
    try {
      if (window.ipc && typeof window.ipc.postMessage === 'function') {
        window.ipc.postMessage(typeof payload === 'string' ? payload : JSON.stringify(payload));
      }
    } catch (_) {}
  }

  function applyGhostState() {
    var root = document.documentElement;
    if (!root) return;
    root.style.transition = 'opacity 0.22s ease';
    if (ghostEnabled && !cursorInside) {
      root.style.opacity = ghostAlpha;
    } else {
      root.style.opacity = '1';
    }
  }

  function ensureLayoutPadding() {
    var body = document.body;
    if (!body) return;
    if (body.style.marginTop !== '30px') {
      body.style.marginTop = '30px';
    }
    if (body.style.height !== 'calc(100vh - 30px)') {
      body.style.height = 'calc(100vh - 30px)';
    }
    var app = document.getElementById('app');
    if (app && app.style.height !== '100%') {
      app.style.height = '100%';
    }
  }

  function makeBtn(label, title, bg, fg) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    if (title) b.title = title;
    b.style.background = bg || '#1f2c34';
    b.style.color = fg || '#d1d7db';
    b.style.border = '1px solid #2a3942';
    b.style.borderRadius = '4px';
    b.style.padding = '2px 7px';
    b.style.fontSize = '11px';
    b.style.fontFamily = 'Segoe UI, system-ui, sans-serif';
    b.style.cursor = 'pointer';
    b.style.lineHeight = '16px';
    b.style.height = '22px';
    b.style.display = 'inline-flex';
    b.style.alignItems = 'center';
    b.style.justifyContent = 'center';
    b.style.userSelect = 'none';
    b.addEventListener('mousedown', function(e) { e.stopPropagation(); });
    return b;
  }

  function injectBar() {
    if (document.getElementById('josjis-stealth-bar')) return;
    var root = document.documentElement;
    if (!root) return;

    var bar = document.createElement('div');
    bar.id = 'josjis-stealth-bar';
    bar.style.position = 'fixed';
    bar.style.top = '0';
    bar.style.left = '0';
    bar.style.right = '0';
    bar.style.height = '30px';
    bar.style.background = '#111b21';
    bar.style.borderBottom = '1px solid #222e35';
    bar.style.display = 'flex';
    bar.style.alignItems = 'center';
    bar.style.justifyContent = 'space-between';
    bar.style.padding = '0 8px';
    bar.style.zIndex = '2147483647';
    bar.style.fontFamily = 'Segoe UI, system-ui, sans-serif';
    bar.style.userSelect = 'none';
    bar.style.boxSizing = 'border-box';

    // Left: Brand + Platform quick pills
    var left = document.createElement('div');
    left.style.display = 'flex';
    left.style.alignItems = 'center';
    left.style.gap = '6px';

    var brand = document.createElement('span');
    brand.textContent = '⚡ JOSJIS WA';
    brand.style.color = '#00a884';
    brand.style.fontWeight = '700';
    brand.style.fontSize = '11px';
    brand.style.letterSpacing = '0.4px';
    brand.style.marginRight = '4px';
    left.appendChild(brand);

    var host = (window.location && window.location.hostname) || '';
    var btnWa = makeBtn('WA', 'WhatsApp Web', host.indexOf('whatsapp') >= 0 ? '#005c4b' : '#1f2c34', '#e9edef');
    var btnDc = makeBtn('DC', 'Discord', host.indexOf('discord') >= 0 ? '#5865f2' : '#1f2c34', '#e9edef');
    var btnTt = makeBtn('TikTok', 'TikTok DM', host.indexOf('tiktok') >= 0 ? '#fe2c55' : '#1f2c34', '#e9edef');

    btnWa.addEventListener('click', function() { postIPC({ channel: 'navigate', url: 'https://web.whatsapp.com' }); });
    btnDc.addEventListener('click', function() { postIPC({ channel: 'navigate', url: 'https://discord.com/app' }); });
    btnTt.addEventListener('click', function() { postIPC({ channel: 'navigate', url: 'https://www.tiktok.com/messages' }); });

    left.appendChild(btnWa);
    left.appendChild(btnDc);
    left.appendChild(btnTt);

    // Right: Stealth controls + OS Window controls
    var right = document.createElement('div');
    right.style.display = 'flex';
    right.style.alignItems = 'center';
    right.style.gap = '5px';

    var btnGhost = makeBtn('Ghost: OFF', 'Redup otomatis saat mouse menjauh', '#1f2c34', '#aebac1');
    btnGhost.addEventListener('click', function() {
      ghostEnabled = !ghostEnabled;
      btnGhost.textContent = ghostEnabled ? 'Ghost: ON' : 'Ghost: OFF';
      btnGhost.style.background = ghostEnabled ? '#00a884' : '#1f2c34';
      btnGhost.style.color = ghostEnabled ? '#0b141a' : '#aebac1';
      btnGhost.style.fontWeight = ghostEnabled ? '700' : '400';
      applyGhostState();
    });

    var btnPin = makeBtn('Pin', 'Always on Top', '#1f2c34', '#aebac1');
    btnPin.addEventListener('click', function() {
      isPinned = !isPinned;
      btnPin.style.background = isPinned ? '#0284c7' : '#1f2c34';
      btnPin.style.color = isPinned ? '#ffffff' : '#aebac1';
      postIPC('toggle-pin');
    });

    var btnMini = makeBtn('Mini', 'Mode Mini Compact (430x660)', '#1f2c34', '#aebac1');
    btnMini.addEventListener('click', function() {
      isMini = !isMini;
      btnMini.textContent = isMini ? 'Normal' : 'Mini';
      btnMini.style.background = isMini ? '#00a884' : '#1f2c34';
      btnMini.style.color = isMini ? '#0b141a' : '#aebac1';
      postIPC('toggle-mini');
    });

    var btnBoss = makeBtn('Hide (Alt+Q)', 'Sembunyikan seketika (Alt+Q)', '#1f2c34', '#aebac1');
    btnBoss.addEventListener('click', function() { postIPC('hide-window'); });

    var btnMin = makeBtn('—', 'Minimize (atau tekan Esc)', '#1f2c34', '#d1d7db');
    btnMin.addEventListener('click', function() { postIPC('minimize-window'); });

    var btnMax = makeBtn('□', 'Maximize / Restore', '#1f2c34', '#d1d7db');
    btnMax.addEventListener('click', function() { postIPC('maximize-window'); });

    var btnClose = makeBtn('✕', 'Tutup Aplikasi', '#1f2c34', '#f87171');
    btnClose.addEventListener('mouseenter', function() { btnClose.style.background = '#dc2626'; btnClose.style.color = '#ffffff'; });
    btnClose.addEventListener('mouseleave', function() { btnClose.style.background = '#1f2c34'; btnClose.style.color = '#f87171'; });
    btnClose.addEventListener('click', function() { postIPC('close-app'); });

    right.appendChild(btnGhost);
    right.appendChild(btnPin);
    right.appendChild(btnMini);
    right.appendChild(btnBoss);
    right.appendChild(btnMin);
    right.appendChild(btnMax);
    right.appendChild(btnClose);

    bar.appendChild(left);
    bar.appendChild(right);

    bar.addEventListener('mousedown', function(e) {
      if (e.button === 0 && !e.target.closest('button')) {
        postIPC('drag-window');
      }
    });
    bar.addEventListener('dblclick', function(e) {
      if (!e.target.closest('button')) {
        postIPC('maximize-window');
      }
    });

    root.appendChild(bar);
    ensureLayoutPadding();
  }

  document.addEventListener('mouseenter', function() { cursorInside = true; applyGhostState(); }, true);
  document.addEventListener('mouseleave', function() { cursorInside = false; applyGhostState(); }, true);
  window.addEventListener('blur', function() { cursorInside = false; applyGhostState(); });
  window.addEventListener('focus', function() { cursorInside = true; applyGhostState(); });

  function bootstrap() {
    injectBar();
    ensureLayoutPadding();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }

  // WhatsApp SPA occasionally resets body styles during hydration
  setInterval(bootstrap, 1200);
})();
"#;

fn main() {
    let mut target_url = String::from("https://web.whatsapp.com");
    let args: Vec<String> = env::args().collect();
    if args.len() > 1 && args[1].starts_with("http") {
        target_url = args[1].clone();
    }

    let event_loop = EventLoopBuilder::<UserEvent>::with_user_event().build();
    let proxy = event_loop.create_proxy();

    // True Borderless Frameless Window
    let window = WindowBuilder::new()
        .with_title("Josjis Desktop")
        .with_inner_size(LogicalSize::new(1020.0, 680.0))
        .with_decorations(false)
        .with_resizable(true)
        .build(&event_loop)
        .expect("Failed to create native desktop window");

    let hwnd = window.hwnd() as HWND;
    APP_HWND.store(hwnd as isize, Ordering::SeqCst);

    // Persistent profile in %LOCALAPPDATA% so WhatsApp QR scan stays logged in forever
    let local_data = env::var("LOCALAPPDATA").unwrap_or_else(|_| ".".to_string());
    let data_dir = PathBuf::from(local_data).join("JosjisWhatsAppNativeProfile");
    let mut web_context = WebContext::new(Some(data_dir));

    let ipc_proxy = proxy.clone();
    let webview = WebViewBuilder::new_with_web_context(&mut web_context)
        .with_url(&target_url)
        .with_devtools(false)
        .with_autoplay(true)
        .with_clipboard(true)
        .with_initialization_script(STEALTH_INIT_SCRIPT)
        .with_permission_handler(|kind| match kind {
            PermissionKind::Microphone
            | PermissionKind::Camera
            | PermissionKind::ClipboardRead
            | PermissionKind::Notifications
            | PermissionKind::Autoplay => PermissionResponse::Allow,
            _ => PermissionResponse::Default,
        })
        .with_new_window_req_handler(|url, _features| {
            open_external_url(&url);
            NewWindowResponse::Deny
        })
        .with_ipc_handler(move |req| {
            let body = req.body();
            if body.contains("minimize-window") {
                let _ = ipc_proxy.send_event(UserEvent::Minimize);
            } else if body.contains("maximize-window") {
                let _ = ipc_proxy.send_event(UserEvent::Maximize);
            } else if body.contains("close-app") {
                let _ = ipc_proxy.send_event(UserEvent::Close);
            } else if body.contains("drag-window") {
                let _ = ipc_proxy.send_event(UserEvent::Drag);
            } else if body.contains("toggle-mini") {
                let _ = ipc_proxy.send_event(UserEvent::ToggleMini);
            } else if body.contains("toggle-pin") {
                let _ = ipc_proxy.send_event(UserEvent::TogglePin);
            } else if body.contains("hide-window") {
                toggle_boss_key();
            } else if body.contains("\"navigate\"") {
                if let Some(pos) = body.find("\"url\":\"") {
                    let rest = &body[pos + 7..];
                    if let Some(end) = rest.find('"') {
                        let url = rest[..end].to_string();
                        let _ = ipc_proxy.send_event(UserEvent::Navigate(url));
                    }
                }
            }
        })
        .build(&window)
        .expect("Failed to initialize embedded WebView2");

    // Global Boss Key (Alt+Q) & Panic Key (Esc)
    let hotkey_proxy = proxy.clone();
    thread::spawn(move || {
        let mut boss_debounced = false;

        while IS_RUNNING.load(Ordering::SeqCst) {
            thread::sleep(Duration::from_millis(60));

            let hwnd = APP_HWND.load(Ordering::SeqCst) as HWND;
            if hwnd.is_null() {
                continue;
            }

            unsafe {
                let alt_pressed = (GetAsyncKeyState(VK_MENU) as i32 & 0x8000) != 0;
                let q_pressed = (GetAsyncKeyState(VK_Q) as i32 & 0x8000) != 0;

                if alt_pressed && q_pressed {
                    if !boss_debounced {
                        boss_debounced = true;
                        toggle_boss_key();
                    }
                } else {
                    boss_debounced = false;
                }

                if !IS_HIDDEN.load(Ordering::SeqCst) {
                    let esc = GetAsyncKeyState(VK_ESCAPE);
                    if (esc as i32 & 0x8000) != 0 {
                        let fg = GetForegroundWindow();
                        if fg == hwnd {
                            let _ = hotkey_proxy.send_event(UserEvent::Minimize);
                            thread::sleep(Duration::from_millis(300));
                        }
                    }
                }
            }
        }
    });

    let mut is_mini = false;
    let mut is_pinned = false;

    event_loop.run(move |event, _, control_flow| {
        *control_flow = ControlFlow::Wait;

        match event {
            Event::UserEvent(UserEvent::Minimize) => {
                window.set_minimized(true);
            }
            Event::UserEvent(UserEvent::Maximize) => {
                window.set_maximized(!window.is_maximized());
            }
            Event::UserEvent(UserEvent::ToggleMini) => {
                is_mini = !is_mini;
                if is_mini {
                    window.set_inner_size(LogicalSize::new(430.0, 660.0));
                    is_pinned = true;
                    window.set_always_on_top(true);
                } else {
                    window.set_inner_size(LogicalSize::new(1020.0, 680.0));
                    is_pinned = false;
                    window.set_always_on_top(false);
                }
            }
            Event::UserEvent(UserEvent::TogglePin) => {
                is_pinned = !is_pinned;
                window.set_always_on_top(is_pinned);
            }
            Event::UserEvent(UserEvent::Navigate(url)) => {
                let _ = webview.load_url(&url);
            }
            Event::UserEvent(UserEvent::Drag) => {
                let _ = window.drag_window();
            }
            Event::UserEvent(UserEvent::Close) => {
                IS_RUNNING.store(false, Ordering::SeqCst);
                *control_flow = ControlFlow::Exit;
            }
            Event::WindowEvent {
                event: WindowEvent::CloseRequested,
                ..
            } => {
                IS_RUNNING.store(false, Ordering::SeqCst);
                *control_flow = ControlFlow::Exit;
            }
            _ => (),
        }
    });
}
