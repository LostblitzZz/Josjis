using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;

namespace Josjis
{
    // =========================================================================
    // Win32 API Definitions for OS-Level Stealth Transparency & Hotkeys
    // =========================================================================
    internal static class NativeMethods
    {
        public const int GWL_EXSTYLE = -20;
        public const int WS_EX_LAYERED = 0x80000;
        public const uint LWA_ALPHA = 0x2;
        public const int SW_MINIMIZE = 6;
        public const int SW_RESTORE = 9;
        public const int VK_ESCAPE = 0x1B;

        public static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
        public static readonly IntPtr HWND_NOTOPMOST = new IntPtr(-2);
        public const uint SWP_NOMOVE = 0x0002;
        public const uint SWP_NOSIZE = 0x0001;

        [StructLayout(LayoutKind.Sequential)]
        public struct POINT
        {
            public int X;
            public int Y;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct RECT
        {
            public int Left;
            public int Top;
            public int Right;
            public int Bottom;
        }

        [DllImport("user32.dll", SetLastError = true)]
        public static extern int GetWindowLong(IntPtr hWnd, int nIndex);

        [DllImport("user32.dll", SetLastError = true)]
        public static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);

        [DllImport("user32.dll", SetLastError = true)]
        public static extern bool SetLayeredWindowAttributes(IntPtr hwnd, uint crKey, byte bAlpha, uint dwFlags);

        [DllImport("user32.dll")]
        public static extern bool GetCursorPos(out POINT lpPoint);

        [DllImport("user32.dll")]
        public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

        [DllImport("user32.dll")]
        public static extern short GetAsyncKeyState(int vKey);

        [DllImport("user32.dll")]
        public static extern IntPtr GetForegroundWindow();

        [DllImport("user32.dll")]
        public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

        [DllImport("user32.dll")]
        public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

        [DllImport("user32.dll")]
        public static extern bool SetForegroundWindow(IntPtr hWnd);

        public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

        [DllImport("user32.dll")]
        public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);

        [DllImport("user32.dll", SetLastError = true)]
        public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    }

    // =========================================================================
    // Active Platform Session Controller
    // =========================================================================
    public class PlatformSession
    {
        public string Name { get; set; }
        public string Url { get; set; }
        public Process ProcessInstance { get; set; }
        public IntPtr MainWindowHandle { get; set; }
        public Thread MonitorThread { get; set; }
        public bool IsRunning { get; set; }
    }

    // =========================================================================
    // Main Josjis Desktop Hub Application
    // =========================================================================
    public class MainForm : Form
    {
        // Colors (WhatsApp & Josjis Stealth Theme)
        private Color clrBg = Color.FromArgb(17, 27, 33);         // #111b21
        private Color clrHeader = Color.FromArgb(32, 44, 51);     // #202c33
        private Color clrCard = Color.FromArgb(24, 34, 41);       // #182229
        private Color clrAccent = Color.FromArgb(0, 168, 132);    // #00a884
        private Color clrDiscord = Color.FromArgb(88, 101, 242);  // #5865f2
        private Color clrTikTok = Color.FromArgb(254, 44, 85);    // #fe2c55
        private Color clrText = Color.FromArgb(233, 237, 239);    // #e9edef
        private Color clrMuted = Color.FromArgb(134, 150, 160);   // #8696a0

        // UI Controls
        private Panel pnlHeader;
        private Label lblTitle;
        private Label lblSubtitle;
        private Label lblPanicHint;

        private Panel pnlBody;
        private Panel cardWA;
        private Panel cardDC;
        private Panel cardTT;
        private Panel cardSettings;

        private TrackBar trkOpacity;
        private Label lblOpacityVal;
        private CheckBox chkAutoDim;
        private CheckBox chkTopMost;

        private Panel pnlFooter;
        private Label lblStatus;
        private NotifyIcon trayIcon;

        // Session tracking
        private PlatformSession activeSession = null;
        private readonly object sessionLock = new object();

        public MainForm()
        {
            InitializeComponent();
            SetupTray();
        }

        private void InitializeComponent()
        {
            this.Text = "Josjis Hub v2.0 - Stealth Desktop Workspace";
            this.Size = new Size(530, 680);
            this.MinimumSize = new Size(500, 600);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = clrBg;
            this.ForeColor = clrText;
            this.Font = new Font("Segoe UI", 9f);
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;

            // -------------------------------------------------------------
            // HEADER PANEL
            // -------------------------------------------------------------
            pnlHeader = new Panel();
            pnlHeader.Dock = DockStyle.Top;
            pnlHeader.Height = 65;
            pnlHeader.BackColor = clrHeader;

            lblTitle = new Label();
            lblTitle.Text = "⚡ Josjis Stealth Workspace";
            lblTitle.Font = new Font("Segoe UI", 13f, FontStyle.Bold);
            lblTitle.ForeColor = clrAccent;
            lblTitle.Location = new Point(16, 10);
            lblTitle.AutoSize = true;

            lblSubtitle = new Label();
            lblSubtitle.Text = "100% riwayat chat & kontak lengkap • Auto-dimming • Tanpa notifikasi mencolok";
            lblSubtitle.Font = new Font("Segoe UI", 8.5f);
            lblSubtitle.ForeColor = clrMuted;
            lblSubtitle.Location = new Point(18, 36);
            lblSubtitle.AutoSize = true;

            lblPanicHint = new Label();
            lblPanicHint.Text = "[Esc] = Panic Hide";
            lblPanicHint.Font = new Font("Segoe UI", 8.5f, FontStyle.Italic);
            lblPanicHint.ForeColor = Color.FromArgb(160, 180, 195);
            lblPanicHint.Location = new Point(395, 14);
            lblPanicHint.AutoSize = true;

            pnlHeader.Controls.Add(lblTitle);
            pnlHeader.Controls.Add(lblSubtitle);
            pnlHeader.Controls.Add(lblPanicHint);

            // -------------------------------------------------------------
            // FOOTER PANEL
            // -------------------------------------------------------------
            pnlFooter = new Panel();
            pnlFooter.Dock = DockStyle.Bottom;
            pnlFooter.Height = 32;
            pnlFooter.BackColor = clrHeader;

            lblStatus = new Label();
            lblStatus.Text = "Status: Siap digunakan. Pilih platform untuk mulai berinteraksi.";
            lblStatus.Font = new Font("Segoe UI", 8.5f);
            lblStatus.ForeColor = clrMuted;
            lblStatus.Location = new Point(14, 7);
            lblStatus.AutoSize = true;

            pnlFooter.Controls.Add(lblStatus);

            // -------------------------------------------------------------
            // BODY CONTAINER (Platform Cards & Settings)
            // -------------------------------------------------------------
            pnlBody = new Panel();
            pnlBody.Dock = DockStyle.Fill;
            pnlBody.AutoScroll = true;
            pnlBody.BackColor = clrBg;

            int cardTop = 15;

            // Card 1: WhatsApp
            cardWA = CreatePlatformCard(
                "[ WhatsApp Desktop ]",
                clrAccent,
                "100% Chat & Kontak Lengkap. Menggunakan engine resmi: riwayat pesan lama, media, dan nama kontak dari ponsel tersinkronisasi penuh.",
                "🚀 Buka WhatsApp",
                cardTop,
                (s, e) => LaunchPlatform("WhatsApp", "https://web.whatsapp.com")
            );
            cardTop += 125;

            // Card 2: Discord
            cardDC = CreatePlatformCard(
                "[ Discord Web ]",
                clrDiscord,
                "Server channels, direct messages, dan grup chat Discord dalam jendela compact stealth tanpa membuka browser utama.",
                "🚀 Buka Discord",
                cardTop,
                (s, e) => LaunchPlatform("Discord", "https://discord.com/app")
            );
            cardTop += 125;

            // Card 3: TikTok DM
            cardTT = CreatePlatformCard(
                "[ TikTok Direct Messages ]",
                clrTikTok,
                "Direct messages dan inbox percakapan TikTok dalam tampilan compact stealth yang bebas gangguan.",
                "🚀 Buka TikTok",
                cardTop,
                (s, e) => LaunchPlatform("TikTok", "https://www.tiktok.com/messages")
            );
            cardTop += 125;

            // Settings Card
            cardSettings = new Panel();
            cardSettings.Location = new Point(16, cardTop);
            cardSettings.Width = 480;
            cardSettings.Height = 145;
            cardSettings.BackColor = clrCard;

            Label lblSetTitle = new Label();
            lblSetTitle.Text = "⚙️ Pengaturan Stealth & Ghost Mode";
            lblSetTitle.Font = new Font("Segoe UI", 10f, FontStyle.Bold);
            lblSetTitle.ForeColor = clrText;
            lblSetTitle.Location = new Point(14, 10);
            lblSetTitle.AutoSize = true;

            lblOpacityVal = new Label();
            lblOpacityVal.Text = "Ghost Opacity: 20% (Tingkat transparansi saat mouse tidak menyentuh jendela)";
            lblOpacityVal.Font = new Font("Segoe UI", 8.5f);
            lblOpacityVal.ForeColor = clrMuted;
            lblOpacityVal.Location = new Point(16, 34);
            lblOpacityVal.AutoSize = true;

            trkOpacity = new TrackBar();
            trkOpacity.Location = new Point(12, 54);
            trkOpacity.Width = 450;
            trkOpacity.Height = 30;
            trkOpacity.Minimum = 10;
            trkOpacity.Maximum = 60;
            trkOpacity.Value = 20;
            trkOpacity.TickFrequency = 10;
            trkOpacity.ValueChanged += (s, e) => {
                lblOpacityVal.Text = string.Format("Ghost Opacity: {0}% (Tingkat transparansi saat mouse tidak menyentuh jendela)", trkOpacity.Value);
            };

            chkAutoDim = new CheckBox();
            chkAutoDim.Text = "Auto-Dimming aktif (Jendela memudar saat mouse keluar)";
            chkAutoDim.ForeColor = clrText;
            chkAutoDim.Location = new Point(16, 88);
            chkAutoDim.AutoSize = true;
            chkAutoDim.Checked = true;

            chkTopMost = new CheckBox();
            chkTopMost.Text = "Pin di atas layar (Always on Top)";
            chkTopMost.ForeColor = clrText;
            chkTopMost.Location = new Point(16, 114);
            chkTopMost.AutoSize = true;
            chkTopMost.Checked = true;

            cardSettings.Controls.Add(lblSetTitle);
            cardSettings.Controls.Add(lblOpacityVal);
            cardSettings.Controls.Add(trkOpacity);
            cardSettings.Controls.Add(chkAutoDim);
            cardSettings.Controls.Add(chkTopMost);

            pnlBody.Controls.Add(cardWA);
            pnlBody.Controls.Add(cardDC);
            pnlBody.Controls.Add(cardTT);
            pnlBody.Controls.Add(cardSettings);

            this.Controls.Add(pnlBody);
            this.Controls.Add(pnlFooter);
            this.Controls.Add(pnlHeader);
        }

        private Panel CreatePlatformCard(string title, Color accentColor, string description, string btnText, int topPos, EventHandler onClick)
        {
            Panel card = new Panel();
            card.Location = new Point(16, topPos);
            card.Width = 480;
            card.Height = 112;
            card.BackColor = clrCard;

            Label lblCardTitle = new Label();
            lblCardTitle.Text = title;
            lblCardTitle.Font = new Font("Segoe UI", 11f, FontStyle.Bold);
            lblCardTitle.ForeColor = accentColor;
            lblCardTitle.Location = new Point(14, 10);
            lblCardTitle.AutoSize = true;

            Label lblDesc = new Label();
            lblDesc.Text = description;
            lblDesc.Font = new Font("Segoe UI", 8.5f);
            lblDesc.ForeColor = clrMuted;
            lblDesc.Location = new Point(14, 34);
            lblDesc.Width = 320;
            lblDesc.Height = 65;

            Button btn = new Button();
            btn.Text = btnText;
            btn.Width = 125;
            btn.Height = 36;
            btn.Location = new Point(342, 38);
            btn.BackColor = accentColor;
            btn.ForeColor = Color.White;
            btn.FlatStyle = FlatStyle.Flat;
            btn.FlatAppearance.BorderSize = 0;
            btn.Font = new Font("Segoe UI", 9.5f, FontStyle.Bold);
            btn.Click += onClick;

            card.Controls.Add(lblCardTitle);
            card.Controls.Add(lblDesc);
            card.Controls.Add(btn);
            return card;
        }

        private void SetupTray()
        {
            trayIcon = new NotifyIcon();
            trayIcon.Text = "Josjis Stealth Workspace";
            trayIcon.Icon = SystemIcons.Application;
            trayIcon.Visible = true;

            ContextMenu menu = new ContextMenu();
            menu.MenuItems.Add("Buka WhatsApp", (s, e) => LaunchPlatform("WhatsApp", "https://web.whatsapp.com"));
            menu.MenuItems.Add("Buka Discord", (s, e) => LaunchPlatform("Discord", "https://discord.com/app"));
            menu.MenuItems.Add("Buka TikTok", (s, e) => LaunchPlatform("TikTok", "https://www.tiktok.com/messages"));
            menu.MenuItems.Add("-");
            menu.MenuItems.Add("Tampilkan Pengaturan", (s, e) => {
                this.WindowState = FormWindowState.Normal;
                this.Show();
                this.BringToFront();
            });
            menu.MenuItems.Add("Keluar", (s, e) => Application.Exit());

            trayIcon.ContextMenu = menu;
            trayIcon.DoubleClick += (s, e) => {
                this.WindowState = FormWindowState.Normal;
                this.Show();
                this.BringToFront();
            };
        }

        // -------------------------------------------------------------
        // Platform Launcher & Stealth Engine
        // -------------------------------------------------------------
        private string FindBrowserPath()
        {
            string[] searchPaths = new string[]
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Microsoft\\Edge\\Application\\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Microsoft\\Edge\\Application\\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Microsoft\\Edge\\Application\\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Google\\Chrome\\Application\\chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Google\\Chrome\\Application\\chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Google\\Chrome\\Application\\chrome.exe")
            };

            foreach (string p in searchPaths)
            {
                if (File.Exists(p)) return p;
            }
            return null;
        }

        private void LaunchPlatform(string name, string url)
        {
            string browser = FindBrowserPath();
            if (string.IsNullOrEmpty(browser))
            {
                MessageBox.Show(
                    "Browser Microsoft Edge atau Chrome tidak ditemukan pada sistem Anda.",
                    "Browser Not Found",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
                return;
            }

            lblStatus.Text = string.Format("Status: Membuka {0} dalam mode compact stealth...", name);

            ThreadPool.QueueUserWorkItem(delegate {
                try
                {
                    // User data profile path (per platform for separate persistent sessions)
                    string profileDir = Path.Combine(
                        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                        "Josjis",
                        name + "_Profile"
                    );

                    if (!Directory.Exists(profileDir))
                    {
                        Directory.CreateDirectory(profileDir);
                    }

                    // Launch in clean borderless App Mode (no address bar, no tabs, native compact window)
                    ProcessStartInfo psi = new ProcessStartInfo();
                    psi.FileName = browser;
                    psi.Arguments = string.Format(
                        "--app=\"{0}\" --user-data-dir=\"{1}\" --window-size=440,680 --no-first-run --no-default-browser-check",
                        url,
                        profileDir
                    );

                    Process proc = Process.Start(psi);
                    if (proc == null) return;

                    // Locate the window handle
                    IntPtr hwnd = IntPtr.Zero;
                    for (int i = 0; i < 30; i++)
                    {
                        Thread.Sleep(250);
                        proc.Refresh();
                        hwnd = proc.MainWindowHandle;
                        if (hwnd != IntPtr.Zero) break;

                        // Fallback: search process by name
                        hwnd = FindWindowByProcessId(proc.Id);
                        if (hwnd != IntPtr.Zero) break;
                    }

                    if (hwnd == IntPtr.Zero)
                    {
                        // Fallback: search any edge/chrome window created recently
                        hwnd = FindWindowByTitleSubstring(name);
                    }

                    PlatformSession session = new PlatformSession();
                    session.Name = name;
                    session.Url = url;
                    session.ProcessInstance = proc;
                    session.MainWindowHandle = hwnd;
                    session.IsRunning = true;

                    lock (sessionLock)
                    {
                        if (activeSession != null)
                        {
                            activeSession.IsRunning = false;
                        }
                        activeSession = session;
                    }

                    // Apply OS-level Layered Window Style for Ghost Transparency
                    if (hwnd != IntPtr.Zero)
                    {
                        int style = NativeMethods.GetWindowLong(hwnd, NativeMethods.GWL_EXSTYLE);
                        NativeMethods.SetWindowLong(hwnd, NativeMethods.GWL_EXSTYLE, style | NativeMethods.WS_EX_LAYERED);
                        NativeMethods.SetLayeredWindowAttributes(hwnd, 0, 255, NativeMethods.LWA_ALPHA);

                        if (chkTopMost.Checked)
                        {
                            NativeMethods.SetWindowPos(hwnd, NativeMethods.HWND_TOPMOST, 0, 0, 0, 0, NativeMethods.SWP_NOMOVE | NativeMethods.SWP_NOSIZE);
                        }
                    }

                    this.BeginInvoke((MethodInvoker)delegate {
                        lblStatus.Text = string.Format("Status: {0} aktif! Ghost mode otomatis memudar saat kursor menjauh.", name);
                    });

                    // Start Stealth Background Controller
                    StartStealthController(session);
                }
                catch (Exception ex)
                {
                    this.BeginInvoke((MethodInvoker)delegate {
                        lblStatus.Text = "Error saat meluncurkan: " + ex.Message;
                    });
                }
            });
        }

        private IntPtr FindWindowByProcessId(int processId)
        {
            IntPtr found = IntPtr.Zero;
            NativeMethods.EnumWindows(delegate (IntPtr hWnd, IntPtr lParam) {
                uint pid;
                NativeMethods.GetWindowThreadProcessId(hWnd, out pid);
                if (pid == processId)
                {
                    StringBuilder sb = new StringBuilder(256);
                    NativeMethods.GetWindowText(hWnd, sb, 256);
                    if (sb.Length > 0)
                    {
                        found = hWnd;
                        return false; // Stop enumeration
                    }
                }
                return true;
            }, IntPtr.Zero);
            return found;
        }

        private IntPtr FindWindowByTitleSubstring(string substr)
        {
            IntPtr found = IntPtr.Zero;
            NativeMethods.EnumWindows(delegate (IntPtr hWnd, IntPtr lParam) {
                StringBuilder sb = new StringBuilder(256);
                NativeMethods.GetWindowText(hWnd, sb, 256);
                string title = sb.ToString();
                if (title.IndexOf(substr, StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    found = hWnd;
                    return false;
                }
                return true;
            }, IntPtr.Zero);
            return found;
        }

        // -------------------------------------------------------------
        // Stealth Transparency & Panic Key Monitoring Loop
        // -------------------------------------------------------------
        private void StartStealthController(PlatformSession session)
        {
            Thread t = new Thread(delegate () {
                byte currentAlpha = 255;
                int outsideCounter = 0;

                while (session.IsRunning && !session.ProcessInstance.HasExited)
                {
                    Thread.Sleep(50);

                    IntPtr hwnd = session.MainWindowHandle;
                    if (hwnd == IntPtr.Zero)
                    {
                        hwnd = session.ProcessInstance.MainWindowHandle;
                        if (hwnd != IntPtr.Zero)
                        {
                            session.MainWindowHandle = hwnd;
                            int style = NativeMethods.GetWindowLong(hwnd, NativeMethods.GWL_EXSTYLE);
                            NativeMethods.SetWindowLong(hwnd, NativeMethods.GWL_EXSTYLE, style | NativeMethods.WS_EX_LAYERED);
                            NativeMethods.SetLayeredWindowAttributes(hwnd, 0, 255, NativeMethods.LWA_ALPHA);
                        }
                        continue;
                    }

                    // 1. Global Panic Key Handler ([Esc] = 0x1B)
                    short escState = NativeMethods.GetAsyncKeyState(NativeMethods.VK_ESCAPE);
                    if ((escState & 0x8000) != 0)
                    {
                        IntPtr fg = NativeMethods.GetForegroundWindow();
                        if (fg == hwnd)
                        {
                            NativeMethods.ShowWindow(hwnd, NativeMethods.SW_MINIMIZE);
                            Thread.Sleep(400); // debounce
                            continue;
                        }
                    }

                    // 2. Mouse Position & Window Rect
                    NativeMethods.POINT pt;
                    NativeMethods.RECT rect;
                    NativeMethods.GetCursorPos(out pt);
                    NativeMethods.GetWindowRect(hwnd, out rect);

                    bool isInside = (pt.X >= rect.Left && pt.X <= rect.Right && pt.Y >= rect.Top && pt.Y <= rect.Bottom);

                    // Read user settings
                    bool autoDimEnabled = true;
                    int targetOpacityPercent = 20;

                    this.Invoke((MethodInvoker)delegate {
                        autoDimEnabled = chkAutoDim.Checked;
                        targetOpacityPercent = trkOpacity.Value;
                    });

                    if (!autoDimEnabled)
                    {
                        if (currentAlpha != 255)
                        {
                            currentAlpha = 255;
                            NativeMethods.SetLayeredWindowAttributes(hwnd, 0, 255, NativeMethods.LWA_ALPHA);
                        }
                        continue;
                    }

                    byte idleAlpha = (byte)Math.Max(25, (int)(targetOpacityPercent * 2.55));

                    if (isInside)
                    {
                        outsideCounter = 0;
                        // Smoothly or quickly restore to 100%
                        if (currentAlpha < 255)
                        {
                            currentAlpha = (byte)Math.Min(255, (int)currentAlpha + 45);
                            NativeMethods.SetLayeredWindowAttributes(hwnd, 0, currentAlpha, NativeMethods.LWA_ALPHA);
                        }
                    }
                    else
                    {
                        outsideCounter++;
                        // Dim after ~200ms outside
                        if (outsideCounter > 4)
                        {
                            if (currentAlpha > idleAlpha)
                            {
                                currentAlpha = (byte)Math.Max((int)idleAlpha, (int)currentAlpha - 25);
                                NativeMethods.SetLayeredWindowAttributes(hwnd, 0, currentAlpha, NativeMethods.LWA_ALPHA);
                            }
                        }
                    }
                }

                // Process exited or terminated
                this.BeginInvoke((MethodInvoker)delegate {
                    lblStatus.Text = string.Format("Status: Sesi {0} telah ditutup.", session.Name);
                });
            });

            t.IsBackground = true;
            session.MonitorThread = t;
            t.Start();
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            if (trayIcon != null)
            {
                trayIcon.Visible = false;
                trayIcon.Dispose();
            }
            base.OnFormClosing(e);
        }

        [STAThread]
        public static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainForm());
        }
    }
}
