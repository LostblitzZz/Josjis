#![windows_subsystem = "windows"]

use std::env;
use std::ffi::c_void;
use std::net::{SocketAddr, TcpStream};
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicIsize, AtomicU8, Ordering};
use std::thread;
use std::time::Duration;

use tao::{
    dpi::{LogicalSize, PhysicalPosition},
    event::{Event, WindowEvent},
    event_loop::{ControlFlow, EventLoopBuilder},
    platform::windows::WindowExtWindows,
    window::WindowBuilder,
};
use wry::{NewWindowResponse, PermissionKind, PermissionResponse, WebContext, WebViewBuilder};

type HWND = *mut c_void;
type BOOL = i32;

const GWL_EXSTYLE: i32 = -20;
const WS_EX_LAYERED: isize = 0x80000;
const LWA_ALPHA: u32 = 0x2;
const SW_HIDE: i32 = 0;
const SW_SHOW: i32 = 5;
const SW_RESTORE: i32 = 9;
const VK_ESCAPE: i32 = 0x1B;
const VK_Q: i32 = 0x51;
const VK_MENU: i32 = 0x12; // Alt key
const SPI_GETWORKAREA: u32 = 0x0030;
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[repr(C)]
#[derive(Default, Copy, Clone)]
struct POINT {
    x: i32,
    y: i32,
}

#[repr(C)]
#[derive(Default, Copy, Clone)]
struct RECT {
    left: i32,
    top: i32,
    right: i32,
    bottom: i32,
}

#[link(name = "user32")]
extern "system" {
    fn ShowWindow(hWnd: HWND, nCmdShow: i32) -> BOOL;
    fn SetForegroundWindow(hWnd: HWND) -> BOOL;
    fn GetAsyncKeyState(vKey: i32) -> i16;
    fn GetForegroundWindow() -> HWND;
    fn IsIconic(hWnd: HWND) -> BOOL;
    fn GetCursorPos(lpPoint: *mut POINT) -> BOOL;
    fn GetWindowRect(hWnd: HWND, lpRect: *mut RECT) -> BOOL;
    fn GetWindowLongPtrW(hWnd: HWND, nIndex: i32) -> isize;
    fn SetWindowLongPtrW(hWnd: HWND, nIndex: i32, dwNewLong: isize) -> isize;
    fn SetLayeredWindowAttributes(hwnd: HWND, crKey: u32, bAlpha: u8, dwFlags: u32) -> BOOL;
    fn SystemParametersInfoW(uiAction: u32, uiParam: u32, pvParam: *mut RECT, fWinIni: u32) -> BOOL;
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
    TogglePin,
    ApplyAlpha(u8),
}

static APP_HWND: AtomicIsize = AtomicIsize::new(0);
static IS_HIDDEN: AtomicBool = AtomicBool::new(false);
static IS_RUNNING: AtomicBool = AtomicBool::new(true);
static GHOST_ENABLED: AtomicBool = AtomicBool::new(true);
static GHOST_PERCENT: AtomicU8 = AtomicU8::new(20);

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

fn apply_window_alpha(hwnd: HWND, alpha: u8) {
    if hwnd.is_null() {
        return;
    }
    unsafe {
        let cur = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        if alpha >= 255 {
            if (cur & WS_EX_LAYERED) != 0 {
                SetLayeredWindowAttributes(hwnd, 0, 255, LWA_ALPHA);
                SetWindowLongPtrW(hwnd, GWL_EXSTYLE, cur & !WS_EX_LAYERED);
            }
        } else {
            if (cur & WS_EX_LAYERED) == 0 {
                SetWindowLongPtrW(hwnd, GWL_EXSTYLE, cur | WS_EX_LAYERED);
            }
            SetLayeredWindowAttributes(hwnd, 0, alpha, LWA_ALPHA);
        }
    }
}

fn is_port_open(port: u16) -> bool {
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    TcpStream::connect_timeout(&addr, Duration::from_millis(200)).is_ok()
}

fn find_repo_dir() -> Option<PathBuf> {
    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Ok(exe) = env::current_exe() {
        if let Some(dir) = exe.parent() {
            candidates.push(dir.to_path_buf());
            if let Some(parent) = dir.parent() {
                candidates.push(parent.to_path_buf());
            }
        }
    }
    if let Ok(cwd) = env::current_dir() {
        candidates.push(cwd.clone());
        if let Some(parent) = cwd.parent() {
            candidates.push(parent.to_path_buf());
        }
    }
    for c in candidates {
        if c.join("index.js").exists() && c.join("package.json").exists() {
            return Some(c);
        }
    }
    None
}

fn spawn_local_backend(repo_dir: &Path) -> Option<Child> {
    Command::new("node")
        .arg("index.js")
        .current_dir(repo_dir)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .ok()
}

fn parse_ghost_ipc(body: &str) {
    if body.contains("\"enabled\":false") {
        GHOST_ENABLED.store(false, Ordering::SeqCst);
    } else if body.contains("\"enabled\":true") {
        GHOST_ENABLED.store(true, Ordering::SeqCst);
    }
    if let Some(pos) = body.find("\"percent\":") {
        let rest = &body[pos + 10..];
        let digits: String = rest
            .chars()
            .skip_while(|c| !c.is_ascii_digit())
            .take_while(|c| c.is_ascii_digit())
            .collect();
        if let Ok(val) = digits.parse::<u8>() {
            GHOST_PERCENT.store(val.clamp(10, 80), Ordering::SeqCst);
        }
    }
}

const LOADING_HTML: &str = r#"<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<style>
  html, body { height: 100%; margin: 0; background: #0a0b0e; color: #c9cdd6; font-family: "Segoe UI", system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 1px solid #1b1e26; box-sizing: border-box; }
  .bar { position: fixed; top: 0; left: 0; right: 0; height: 28px; background: #07080b; border-bottom: 1px solid #1d2028; display: flex; align-items: center; justify-content: space-between; padding: 0 8px; font-size: 11px; user-select: none; }
  .btn { background: #14171f; border: 1px solid #222632; color: #9ea4b3; border-radius: 4px; padding: 1px 6px; cursor: pointer; font-size: 10.5px; }
  .card { text-align: center; padding: 20px; max-width: 310px; }
  .spinner { width: 24px; height: 24px; border: 2px solid #232734; border-top-color: #5865f2; border-radius: 50%; margin: 0 auto 12px; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>
  <div class="bar" onmousedown="if(event.button===0 && !event.target.closest('button')) window.ipc.postMessage('drag-window')">
    <span># dev-workspace</span>
    <button class="btn" onclick="window.ipc.postMessage('close-app')">✕</button>
  </div>
  <div class="card">
    <div class="spinner"></div>
    <div style="font-size:13px;font-weight:600;color:#fff;margin-bottom:6px;">Menghubungkan Josjis Engine...</div>
    <div style="font-size:11px;color:#7e8494;">Menyiapkan antarmuka WhatsApp mode Discord dark.</div>
  </div>
  <script>
    async function poll() {
      try {
        const r = await fetch('http://127.0.0.1:3821/api/status');
        if (r.ok) { window.location.replace('http://127.0.0.1:3821/'); return; }
      } catch (_) {}
      setTimeout(poll, 450);
    }
    setTimeout(poll, 350);
  </script>
</body>
</html>"#;

const STANDALONE_FALLBACK_HTML: &str = r#"<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<style>
  html, body { height: 100%; margin: 0; background: #0a0b0e; color: #e4e6eb; font-family: "Segoe UI", system-ui, sans-serif; display: flex; flex-direction: column; border: 1px solid #1b1e26; box-sizing: border-box; }
  .bar { height: 28px; background: #07080b; border-bottom: 1px solid #1d2028; display: flex; align-items: center; justify-content: space-between; padding: 0 8px; font-size: 11px; user-select: none; }
  .btn { background: #14171f; border: 1px solid #222632; color: #c9cdd6; border-radius: 4px; padding: 2px 8px; cursor: pointer; font-size: 11px; }
  .primary { background: #5865f2; border-color: #5865f2; color: #fff; font-weight: 600; padding: 8px 12px; width: 100%; }
  .wrap { flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 20px; gap: 10px; }
  code { background: #161920; padding: 2px 5px; border-radius: 4px; color: #a3b3ff; font-size: 11px; }
</style>
</head>
<body>
  <div class="bar" onmousedown="if(event.button===0 && !event.target.closest('button')) window.ipc.postMessage('drag-window')">
    <span># josjis-stealth</span>
    <div style="display:flex;gap:4px;">
      <button class="btn" onclick="window.ipc.postMessage('minimize-window')">—</button>
      <button class="btn" onclick="window.ipc.postMessage('close-app')">✕</button>
    </div>
  </div>
  <div class="wrap">
    <h3 style="margin:0;font-size:14px;">Mode UI Hitam (Discord Skin) butuh folder Josjis</h3>
    <p style="margin:0;font-size:11.5px;color:#8e94a4;line-height:1.5;">
      Letakkan <code>josjis-wa.exe</code> di folder <code>Josjis\dist\</code> lalu jalankan <code>start.bat</code> (atau pastikan <code>node index.js</code> aktif di port 3821) untuk memuat chat WhatsApp berwajah Discord hitam.
    </p>
    <button class="btn primary" onclick="window.location.replace('http://127.0.0.1:3821/')">↻ Coba Konek ke Engine Lokal (3821)</button>
    <button class="btn" style="padding:8px 12px;width:100%;" onclick="window.location.replace('https://web.whatsapp.com')">Buka WhatsApp Web Saja</button>
  </div>
</body>
</html>"#;

fn main() {
    let args: Vec<String> = env::args().collect();
    let cli_url = if args.len() > 1 && args[1].starts_with("http") {
        Some(args[1].clone())
    } else {
        None
    };

    let mut backend_child: Option<Child> = None;
    let mut initial_url = cli_url;
    let mut use_loading_html = false;

    if initial_url.is_none() {
        if is_port_open(3821) {
            initial_url = Some(String::from("http://127.0.0.1:3821/"));
        } else if let Some(repo_dir) = find_repo_dir() {
            backend_child = spawn_local_backend(&repo_dir);
            for _ in 0..18 {
                if is_port_open(3821) {
                    initial_url = Some(String::from("http://127.0.0.1:3821/"));
                    break;
                }
                thread::sleep(Duration::from_millis(150));
            }
            if initial_url.is_none() {
                use_loading_html = true;
            }
        }
    }

    let event_loop = EventLoopBuilder::<UserEvent>::with_user_event().build();
    let proxy = event_loop.create_proxy();

    // Compact corner widget (395x560, frameless, always on top)
    let logical_w = 395.0_f64;
    let logical_h = 560.0_f64;
    let window = WindowBuilder::new()
        .with_title("dev-workspace · Discord")
        .with_inner_size(LogicalSize::new(logical_w, logical_h))
        .with_decorations(false)
        .with_resizable(true)
        .with_always_on_top(true)
        .build(&event_loop)
        .expect("Failed to create native desktop window");

    // Position neatly at the bottom-right corner above taskbar
    let hwnd = window.hwnd() as HWND;
    APP_HWND.store(hwnd as isize, Ordering::SeqCst);

    let scale = window.scale_factor();
    let phys_w = (logical_w * scale).round() as i32;
    let phys_h = (logical_h * scale).round() as i32;
    let margin = (14.0 * scale).round() as i32;
    let mut work_area = RECT::default();
    let ok = unsafe { SystemParametersInfoW(SPI_GETWORKAREA, 0, &mut work_area, 0) };
    if ok != 0 && work_area.right > phys_w && work_area.bottom > phys_h {
        let x = (work_area.right - phys_w - margin).max(work_area.left);
        let y = (work_area.bottom - phys_h - margin).max(work_area.top);
        window.set_outer_position(PhysicalPosition::new(x, y));
    }

    // Persistent WebView2 profile
    let local_data = env::var("LOCALAPPDATA").unwrap_or_else(|_| ".".to_string());
    let data_dir = PathBuf::from(local_data).join("JosjisDiscordCornerProfile");
    let mut web_context = WebContext::new(Some(data_dir));

    let ipc_proxy = proxy.clone();
    let mut builder = WebViewBuilder::new_with_web_context(&mut web_context)
        .with_devtools(false)
        .with_autoplay(true)
        .with_clipboard(true)
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
            } else if body.contains("toggle-pin") {
                let _ = ipc_proxy.send_event(UserEvent::TogglePin);
            } else if body.contains("set-ghost") {
                parse_ghost_ipc(body);
            } else if body.contains("hide-window") {
                toggle_boss_key();
            }
        });

    builder = if let Some(ref url) = initial_url {
        builder.with_url(url)
    } else if use_loading_html {
        builder.with_html(LOADING_HTML)
    } else {
        builder.with_html(STANDALONE_FALLBACK_HTML)
    };

    let _webview = builder
        .build(&window)
        .expect("Failed to initialize embedded WebView2");

    // Background Monitor: Boss Key (Alt+Q), Panic Key (Esc), & Real OS-Level 20% Transparency Ghost Mode
    let monitor_proxy = proxy.clone();
    thread::spawn(move || {
        let mut boss_debounced = false;
        let mut current_alpha: u8 = 255;
        let mut outside_ticks: u32 = 0;

        while IS_RUNNING.load(Ordering::SeqCst) {
            thread::sleep(Duration::from_millis(50));

            let hwnd = APP_HWND.load(Ordering::SeqCst) as HWND;
            if hwnd.is_null() {
                continue;
            }

            // 1. Global Boss Key (Alt + Q)
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
            }

            if IS_HIDDEN.load(Ordering::SeqCst) {
                continue;
            }

            let is_minimized = unsafe { IsIconic(hwnd) != 0 };
            if is_minimized {
                continue;
            }

            // 2. Panic Minimize (Esc) when active
            unsafe {
                let esc = GetAsyncKeyState(VK_ESCAPE);
                if (esc as i32 & 0x8000) != 0 && GetForegroundWindow() == hwnd {
                    let _ = monitor_proxy.send_event(UserEvent::Minimize);
                    thread::sleep(Duration::from_millis(300));
                    continue;
                }
            }

            // 3. Real OS-Level Ghost Opacity (default 20% = alpha 51 when cursor leaves)
            if !GHOST_ENABLED.load(Ordering::SeqCst) {
                outside_ticks = 0;
                if current_alpha < 255 {
                    current_alpha = 255;
                    let _ = monitor_proxy.send_event(UserEvent::ApplyAlpha(255));
                }
                continue;
            }

            let mut pt = POINT::default();
            let mut rect = RECT::default();
            unsafe {
                GetCursorPos(&mut pt);
                GetWindowRect(hwnd, &mut rect);
            }

            let is_inside =
                pt.x >= rect.left && pt.x <= rect.right && pt.y >= rect.top && pt.y <= rect.bottom;
            let pct = GHOST_PERCENT.load(Ordering::SeqCst) as u16;
            let target_alpha = ((pct * 255) / 100).clamp(25, 230) as u8;

            if is_inside {
                outside_ticks = 0;
                if current_alpha < 255 {
                    current_alpha = current_alpha.saturating_add(65);
                    let _ = monitor_proxy.send_event(UserEvent::ApplyAlpha(current_alpha));
                }
            } else {
                outside_ticks += 1;
                if outside_ticks > 4 && current_alpha != target_alpha {
                    if current_alpha > target_alpha {
                        current_alpha = current_alpha.saturating_sub(32).max(target_alpha);
                    } else {
                        current_alpha = current_alpha.saturating_add(32).min(target_alpha);
                    }
                    let _ = monitor_proxy.send_event(UserEvent::ApplyAlpha(current_alpha));
                }
            }
        }
    });

    let mut is_pinned = true;

    event_loop.run(move |event, _, control_flow| {
        *control_flow = ControlFlow::Wait;

        match event {
            Event::UserEvent(UserEvent::Minimize) => {
                window.set_minimized(true);
            }
            Event::UserEvent(UserEvent::Maximize) => {
                window.set_maximized(!window.is_maximized());
            }
            Event::UserEvent(UserEvent::TogglePin) => {
                is_pinned = !is_pinned;
                window.set_always_on_top(is_pinned);
            }
            Event::UserEvent(UserEvent::ApplyAlpha(alpha)) => {
                apply_window_alpha(window.hwnd() as HWND, alpha);
            }
            Event::UserEvent(UserEvent::Drag) => {
                let _ = window.drag_window();
            }
            Event::UserEvent(UserEvent::Close) => {
                IS_RUNNING.store(false, Ordering::SeqCst);
                if let Some(ref mut child) = backend_child {
                    let _ = child.kill();
                    let _ = child.wait();
                }
                *control_flow = ControlFlow::Exit;
            }
            Event::WindowEvent {
                event: WindowEvent::CloseRequested,
                ..
            } => {
                IS_RUNNING.store(false, Ordering::SeqCst);
                if let Some(ref mut child) = backend_child {
                    let _ = child.kill();
                    let _ = child.wait();
                }
                *control_flow = ControlFlow::Exit;
            }
            _ => (),
        }
    });
}
