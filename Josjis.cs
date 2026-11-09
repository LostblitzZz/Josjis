using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;
using System.Windows.Forms;

namespace Josjis
{
    // =========================================================================
    // 1. Zero-Dependency Lightweight JSON Parser (C# 5.0 compatible)
    // =========================================================================
    public class JsonValue
    {
        public enum JsonType { Null, Boolean, Number, String, Array, Object }
        public JsonType Type;
        public bool BoolVal;
        public double NumVal;
        public string StrVal;
        public List<JsonValue> ArrVal;
        public Dictionary<string, JsonValue> ObjVal;

        public JsonValue(JsonType type)
        {
            Type = type;
            if (type == JsonType.Array) ArrVal = new List<JsonValue>();
            if (type == JsonType.Object) ObjVal = new Dictionary<string, JsonValue>();
        }

        public string AsString() { return StrVal != null ? StrVal : ""; }
        public long AsLong() { return (long)NumVal; }
        public int AsInt() { return (int)NumVal; }
        public bool AsBool() { return BoolVal; }
        public List<JsonValue> AsList() { return ArrVal != null ? ArrVal : new List<JsonValue>(); }

        public JsonValue this[string key]
        {
            get
            {
                if (ObjVal != null && ObjVal.ContainsKey(key)) return ObjVal[key];
                return new JsonValue(JsonType.Null);
            }
        }

        public JsonValue this[int index]
        {
            get
            {
                if (ArrVal != null && index >= 0 && index < ArrVal.Count) return ArrVal[index];
                return new JsonValue(JsonType.Null);
            }
        }
    }

    public static class MiniJson
    {
        public static JsonValue Parse(string json)
        {
            if (string.IsNullOrEmpty(json)) return new JsonValue(JsonValue.JsonType.Null);
            int idx = 0;
            return ParseVal(json, ref idx);
        }

        private static void SkipWs(string s, ref int idx)
        {
            while (idx < s.Length && (s[idx] == ' ' || s[idx] == '\t' || s[idx] == '\r' || s[idx] == '\n'))
                idx++;
        }

        private static JsonValue ParseVal(string s, ref int idx)
        {
            SkipWs(s, ref idx);
            if (idx >= s.Length) return new JsonValue(JsonValue.JsonType.Null);
            char c = s[idx];
            if (c == '{') return ParseObj(s, ref idx);
            if (c == '[') return ParseArr(s, ref idx);
            if (c == '"') return ParseStr(s, ref idx);
            if (c == 't' || c == 'f') return ParseBool(s, ref idx);
            if (c == 'n') return ParseNull(s, ref idx);
            return ParseNum(s, ref idx);
        }

        private static JsonValue ParseObj(string s, ref int idx)
        {
            idx++; // skip '{'
            JsonValue obj = new JsonValue(JsonValue.JsonType.Object);
            SkipWs(s, ref idx);
            if (idx < s.Length && s[idx] == '}') { idx++; return obj; }

            while (idx < s.Length)
            {
                SkipWs(s, ref idx);
                string key = ParseStr(s, ref idx).AsString();
                SkipWs(s, ref idx);
                if (idx < s.Length && s[idx] == ':') idx++;
                JsonValue val = ParseVal(s, ref idx);
                obj.ObjVal[key] = val;
                SkipWs(s, ref idx);
                if (idx < s.Length && s[idx] == ',') { idx++; continue; }
                if (idx < s.Length && s[idx] == '}') { idx++; break; }
            }
            return obj;
        }

        private static JsonValue ParseArr(string s, ref int idx)
        {
            idx++; // skip '['
            JsonValue arr = new JsonValue(JsonValue.JsonType.Array);
            SkipWs(s, ref idx);
            if (idx < s.Length && s[idx] == ']') { idx++; return arr; }

            while (idx < s.Length)
            {
                SkipWs(s, ref idx);
                arr.ArrVal.Add(ParseVal(s, ref idx));
                SkipWs(s, ref idx);
                if (idx < s.Length && s[idx] == ',') { idx++; continue; }
                if (idx < s.Length && s[idx] == ']') { idx++; break; }
            }
            return arr;
        }

        private static JsonValue ParseStr(string s, ref int idx)
        {
            idx++; // skip '"'
            StringBuilder sb = new StringBuilder();
            while (idx < s.Length)
            {
                char c = s[idx++];
                if (c == '"') break;
                if (c == '\\' && idx < s.Length)
                {
                    char esc = s[idx++];
                    if (esc == 'n') sb.Append('\n');
                    else if (esc == 'r') sb.Append('\r');
                    else if (esc == 't') sb.Append('\t');
                    else if (esc == '"') sb.Append('"');
                    else if (esc == '\\') sb.Append('\\');
                    else if (esc == 'u' && idx + 4 <= s.Length)
                    {
                        string hex = s.Substring(idx, 4);
                        idx += 4;
                        try { sb.Append((char)Convert.ToInt32(hex, 16)); } catch { }
                    }
                    else sb.Append(esc);
                }
                else
                {
                    sb.Append(c);
                }
            }
            JsonValue res = new JsonValue(JsonValue.JsonType.String);
            res.StrVal = sb.ToString();
            return res;
        }

        private static JsonValue ParseBool(string s, ref int idx)
        {
            JsonValue res = new JsonValue(JsonValue.JsonType.Boolean);
            if (s.IndexOf("true", idx) == idx) { res.BoolVal = true; idx += 4; }
            else if (s.IndexOf("false", idx) == idx) { res.BoolVal = false; idx += 5; }
            return res;
        }

        private static JsonValue ParseNull(string s, ref int idx)
        {
            if (s.IndexOf("null", idx) == idx) idx += 4;
            return new JsonValue(JsonValue.JsonType.Null);
        }

        private static JsonValue ParseNum(string s, ref int idx)
        {
            int start = idx;
            if (idx < s.Length && s[idx] == '-') idx++;
            while (idx < s.Length && ((s[idx] >= '0' && s[idx] <= '9') || s[idx] == '.' || s[idx] == 'e' || s[idx] == 'E' || s[idx] == '+' || s[idx] == '-'))
                idx++;
            string numStr = s.Substring(start, idx - start);
            double d = 0;
            double.TryParse(numStr, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out d);
            JsonValue res = new JsonValue(JsonValue.JsonType.Number);
            res.NumVal = d;
            return res;
        }
    }

    // =========================================================================
    // 2. Data Models
    // =========================================================================
    public class ChannelItem
    {
        public string Id { get; set; }
        public string RawId { get; set; }
        public string DisplayName { get; set; }
        public string Platform { get; set; }
        public bool IsGroup { get; set; }
        public long Timestamp { get; set; }
        public string LastSnippet { get; set; }

        public override string ToString()
        {
            return DisplayName;
        }
    }

    public class MessageItem
    {
        public string Source { get; set; }
        public string ChannelId { get; set; }
        public string ChannelName { get; set; }
        public string Sender { get; set; }
        public bool IsMe { get; set; }
        public bool IsGroup { get; set; }
        public string Text { get; set; }
        public long Timestamp { get; set; }
    }

    // =========================================================================
    // 3. Flicker-Free Double Buffered UI Controls
    // =========================================================================
    public class DoubleBufferedListBox : ListBox
    {
        public DoubleBufferedListBox()
        {
            this.SetStyle(ControlStyles.OptimizedDoubleBuffer | ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint, true);
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            Region r = new Region(e.ClipRectangle);
            e.Graphics.FillRegion(new SolidBrush(this.BackColor), r);
            if (this.Items.Count > 0)
            {
                for (int i = 0; i < this.Items.Count; i++)
                {
                    Rectangle rect = this.GetItemRectangle(i);
                    if (e.ClipRectangle.IntersectsWith(rect))
                    {
                        DrawItemState state = (this.SelectedIndex == i) ? DrawItemState.Selected : DrawItemState.Default;
                        OnDrawItem(new DrawItemEventArgs(e.Graphics, this.Font, rect, i, state, this.ForeColor, this.BackColor));
                    }
                }
            }
            base.OnPaint(e);
        }
    }

    // =========================================================================
    // 4. Main Desktop Application Form
    // =========================================================================
    public class MainForm : Form
    {
        private const string API_URL = "http://127.0.0.1:3821";

        // Layout Containers
        private Panel pnlTopBar;
        private Panel pnlPlatforms;
        private Panel pnlWhatsApp;
        private Panel pnlContacts;
        private Panel pnlChat;
        private Panel pnlChatHeader;
        private Panel pnlInput;

        // Top Bar Controls
        private Label lblAppTitle;
        private Button btnPlatformMenu;
        private Button btnResync;
        private Button btnMiniToggle;
        private CheckBox chkTopMost;
        private Label lblOpacity;
        private TrackBar trkOpacity;
        private Label lblPanicHint;

        // Platform Selector Cards
        private Label lblPlatTitle;
        private Label lblPlatSubtitle;
        private Panel cardWA;
        private Panel cardDC;
        private Panel cardTT;

        // WhatsApp Controls
        private TextBox txtSearch;
        private Button btnNewChat;
        private DoubleBufferedListBox lstContacts;
        private Label lblContactCount;

        private Label lblActiveName;
        private Label lblActiveDetail;
        private DoubleBufferedListBox lstMessages;
        private TextBox txtInput;
        private Button btnSend;

        // Timers & Stealth State
        private System.Windows.Forms.Timer tmrStealth;
        private System.Windows.Forms.Timer tmrSync;
        private double idleOpacity = 0.20;
        private bool isSyncing = false;

        // Data caches
        private List<ChannelItem> allChannels = new List<ChannelItem>();
        private ChannelItem activeChannel = null;
        private List<MessageItem> currentMessages = new List<MessageItem>();

        // Styling Colors (WhatsApp Dark & Stealth Theme)
        private Color clrBgDark = Color.FromArgb(17, 27, 33);      // #111b21
        private Color clrHeader = Color.FromArgb(32, 44, 51);      // #202c33
        private Color clrChatBg = Color.FromArgb(11, 20, 26);      // #0b141a
        private Color clrAccent = Color.FromArgb(0, 168, 132);     // #00a884
        private Color clrBubbleMe = Color.FromArgb(0, 92, 75);     // #005c4b
        private Color clrBubbleOther = Color.FromArgb(32, 44, 51);  // #202c33
        private Color clrTextPrimary = Color.FromArgb(233, 237, 239); // #e9edef
        private Color clrTextMuted = Color.FromArgb(134, 150, 160);   // #8696a0
        private Color clrSelected = Color.FromArgb(42, 57, 66);    // #2a3942

        public MainForm()
        {
            InitializeComponent();
            SetupTimers();
            TriggerSync();
        }

        private void InitializeComponent()
        {
            this.Text = "Josjis Hub v2.0 - Ghost Workspace";
            this.Size = new Size(740, 580);
            this.MinimumSize = new Size(380, 420);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = clrBgDark;
            this.ForeColor = clrTextPrimary;
            this.Font = new Font("Segoe UI", 9f);
            this.KeyPreview = true;
            this.DoubleBuffered = true;

            // -------------------------------------------------------------
            // TOP NAVIGATION BAR
            // -------------------------------------------------------------
            pnlTopBar = new Panel();
            pnlTopBar.Dock = DockStyle.Top;
            pnlTopBar.Height = 42;
            pnlTopBar.BackColor = clrHeader;

            lblAppTitle = new Label();
            lblAppTitle.Text = "⚡ Josjis";
            lblAppTitle.Font = new Font("Segoe UI", 11f, FontStyle.Bold);
            lblAppTitle.ForeColor = clrAccent;
            lblAppTitle.Location = new Point(10, 10);
            lblAppTitle.AutoSize = true;

            btnPlatformMenu = CreateDarkButton("📁 Platform Hub", 100, 26);
            btnPlatformMenu.Location = new Point(90, 8);
            btnPlatformMenu.Click += (s, e) => TogglePlatformSelector();

            btnResync = CreateDarkButton("🔄 Sync", 65, 26);
            btnResync.Location = new Point(195, 8);
            btnResync.Click += (s, e) => OnResyncClick();

            btnMiniToggle = CreateDarkButton("📐 Mini", 60, 26);
            btnMiniToggle.Location = new Point(265, 8);
            btnMiniToggle.Click += (s, e) => ToggleMiniMode();

            chkTopMost = new CheckBox();
            chkTopMost.Text = "📌 Pin";
            chkTopMost.Location = new Point(335, 11);
            chkTopMost.AutoSize = true;
            chkTopMost.ForeColor = clrTextMuted;
            chkTopMost.CheckedChanged += (s, e) => { this.TopMost = chkTopMost.Checked; };

            lblOpacity = new Label();
            lblOpacity.Text = "Ghost: 20%";
            lblOpacity.ForeColor = clrTextMuted;
            lblOpacity.Location = new Point(410, 12);
            lblOpacity.AutoSize = true;

            trkOpacity = new TrackBar();
            trkOpacity.Minimum = 10;
            trkOpacity.Maximum = 60;
            trkOpacity.Value = 20;
            trkOpacity.TickFrequency = 10;
            trkOpacity.Width = 100;
            trkOpacity.Height = 26;
            trkOpacity.Location = new Point(485, 8);
            trkOpacity.ValueChanged += (s, e) => {
                idleOpacity = trkOpacity.Value / 100.0;
                lblOpacity.Text = string.Format("Ghost: {0}%", trkOpacity.Value);
            };

            lblPanicHint = new Label();
            lblPanicHint.Text = "[Esc] Hide";
            lblPanicHint.ForeColor = Color.FromArgb(100, 120, 130);
            lblPanicHint.Location = new Point(600, 12);
            lblPanicHint.AutoSize = true;

            pnlTopBar.Controls.Add(lblAppTitle);
            pnlTopBar.Controls.Add(btnPlatformMenu);
            pnlTopBar.Controls.Add(btnResync);
            pnlTopBar.Controls.Add(btnMiniToggle);
            pnlTopBar.Controls.Add(chkTopMost);
            pnlTopBar.Controls.Add(lblOpacity);
            pnlTopBar.Controls.Add(trkOpacity);
            pnlTopBar.Controls.Add(lblPanicHint);

            // -------------------------------------------------------------
            // PLATFORM SELECTOR PANEL (Default Welcome Screen)
            // -------------------------------------------------------------
            pnlPlatforms = new Panel();
            pnlPlatforms.Dock = DockStyle.Fill;
            pnlPlatforms.BackColor = clrBgDark;
            pnlPlatforms.AutoScroll = true;

            lblPlatTitle = new Label();
            lblPlatTitle.Text = "Josjis Stealth Multi-Chat Workspace";
            lblPlatTitle.Font = new Font("Segoe UI", 14f, FontStyle.Bold);
            lblPlatTitle.ForeColor = clrTextPrimary;
            lblPlatTitle.Location = new Point(25, 20);
            lblPlatTitle.AutoSize = true;

            lblPlatSubtitle = new Label();
            lblPlatSubtitle.Text = "Aplikasi percakapan stealth native: auto-dimming saat kursor menjauh, resizable, dan bebas notifikasi.";
            lblPlatSubtitle.ForeColor = clrTextMuted;
            lblPlatSubtitle.Location = new Point(27, 50);
            lblPlatSubtitle.AutoSize = true;

            // Card 1: WhatsApp
            cardWA = CreatePlatformCard(
                "[ WhatsApp Desktop ]",
                "Status: Online & Ready (Baileys Multi-Device)",
                "Akses langsung chat personal, grup, pesan terkini WhatsApp.\nTersinkronisasi realtime dan mendukung pengiriman nomor langsung.",
                clrAccent,
                "Buka WhatsApp Chat",
                (s, e) => ShowWhatsAppView()
            );
            cardWA.Location = new Point(25, 85);

            // Card 2: Discord
            cardDC = CreatePlatformCard(
                "[ Discord Gateway ]",
                "Status: Standby (Bot Gateway Mode)",
                "Adapter bot Discord untuk memantau server & channels.\nMasukkan token bot Discord pada file .env untuk mengaktifkan saluran.",
                Color.FromArgb(88, 101, 242), // Blurple
                "Info Discord",
                (s, e) => MessageBox.Show(
                    "Konfigurasi Discord:\n\n1. Masukkan DISCORD_TOKEN di file .env\n2. Masukkan ID channel di konfigurasi bot\n3. Restart backend (start.bat)",
                    "Discord Gateway Standby",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information
                )
            );
            cardDC.Location = new Point(25, 215);

            // Card 3: TikTok DM
            cardTT = CreatePlatformCard(
                "[ TikTok Direct Message ]",
                "Status: Standby (Headless Cookie Session)",
                "Placeholder adapter TikTok Direct Message.\nMendukung sesi interaksi melalui file cookie headless auth/tiktok_cookies.json.",
                Color.FromArgb(254, 44, 85), // TikTok Pink
                "Info TikTok",
                (s, e) => MessageBox.Show(
                    "Konfigurasi TikTok DM:\n\n1. Ekspor session cookie TikTok Anda\n2. Simpan di auth/tiktok_cookies.json\n3. Modul standby menunggu aktivasi sesi",
                    "TikTok DM Standby",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information
                )
            );
            cardTT.Location = new Point(25, 345);

            pnlPlatforms.Controls.Add(lblPlatTitle);
            pnlPlatforms.Controls.Add(lblPlatSubtitle);
            pnlPlatforms.Controls.Add(cardWA);
            pnlPlatforms.Controls.Add(cardDC);
            pnlPlatforms.Controls.Add(cardTT);

            // -------------------------------------------------------------
            // WHATSAPP INTERFACE PANEL
            // -------------------------------------------------------------
            pnlWhatsApp = new Panel();
            pnlWhatsApp.Dock = DockStyle.Fill;
            pnlWhatsApp.BackColor = clrChatBg;
            pnlWhatsApp.Visible = false;

            // Contacts Left Panel
            pnlContacts = new Panel();
            pnlContacts.Dock = DockStyle.Left;
            pnlContacts.Width = 260;
            pnlContacts.BackColor = clrBgDark;

            Panel pnlContactTop = new Panel();
            pnlContactTop.Dock = DockStyle.Top;
            pnlContactTop.Height = 72;
            pnlContactTop.BackColor = clrBgDark;

            txtSearch = new TextBox();
            txtSearch.Location = new Point(8, 8);
            txtSearch.Width = 244;
            txtSearch.BackColor = clrHeader;
            txtSearch.ForeColor = clrTextPrimary;
            txtSearch.BorderStyle = BorderStyle.FixedSingle;
            txtSearch.Font = new Font("Segoe UI", 9f);
            txtSearch.Text = "Cari kontak / nomor...";
            txtSearch.Enter += (s, e) => { if (txtSearch.Text == "Cari kontak / nomor...") txtSearch.Text = ""; };
            txtSearch.Leave += (s, e) => { if (string.IsNullOrWhiteSpace(txtSearch.Text)) txtSearch.Text = "Cari kontak / nomor..."; };
            txtSearch.TextChanged += (s, e) => FilterContacts(txtSearch.Text);

            btnNewChat = CreateDarkButton("+ Nomor Baru", 118, 26);
            btnNewChat.Location = new Point(8, 38);
            btnNewChat.Click += (s, e) => OnNewChatClick();

            Button btnSyncContacts = CreateDarkButton("🔄 Refresh", 118, 26);
            btnSyncContacts.Location = new Point(134, 38);
            btnSyncContacts.Click += (s, e) => OnResyncClick();

            pnlContactTop.Controls.Add(txtSearch);
            pnlContactTop.Controls.Add(btnNewChat);
            pnlContactTop.Controls.Add(btnSyncContacts);

            lstContacts = new DoubleBufferedListBox();
            lstContacts.Dock = DockStyle.Fill;
            lstContacts.BackColor = clrBgDark;
            lstContacts.ForeColor = clrTextPrimary;
            lstContacts.BorderStyle = BorderStyle.None;
            lstContacts.DrawMode = DrawMode.OwnerDrawFixed;
            lstContacts.ItemHeight = 52;
            lstContacts.DrawItem += LstContacts_DrawItem;
            lstContacts.SelectedIndexChanged += LstContacts_SelectedIndexChanged;

            lblContactCount = new Label();
            lblContactCount.Dock = DockStyle.Bottom;
            lblContactCount.Height = 22;
            lblContactCount.BackColor = clrHeader;
            lblContactCount.ForeColor = clrTextMuted;
            lblContactCount.Font = new Font("Segoe UI", 8f);
            lblContactCount.TextAlign = ContentAlignment.MiddleCenter;
            lblContactCount.Text = "Menghubungkan ke backend...";

            pnlContacts.Controls.Add(lstContacts);
            pnlContacts.Controls.Add(pnlContactTop);
            pnlContacts.Controls.Add(lblContactCount);

            // Chat Right Panel
            pnlChat = new Panel();
            pnlChat.Dock = DockStyle.Fill;
            pnlChat.BackColor = clrChatBg;

            pnlChatHeader = new Panel();
            pnlChatHeader.Dock = DockStyle.Top;
            pnlChatHeader.Height = 44;
            pnlChatHeader.BackColor = clrHeader;

            lblActiveName = new Label();
            lblActiveName.Text = "Pilih kontak untuk mulai chat";
            lblActiveName.Font = new Font("Segoe UI", 10.5f, FontStyle.Bold);
            lblActiveName.ForeColor = clrTextPrimary;
            lblActiveName.Location = new Point(12, 4);
            lblActiveName.AutoSize = true;

            lblActiveDetail = new Label();
            lblActiveDetail.Text = "Josjis WhatsApp Stealth";
            lblActiveDetail.Font = new Font("Segoe UI", 8f);
            lblActiveDetail.ForeColor = clrTextMuted;
            lblActiveDetail.Location = new Point(13, 24);
            lblActiveDetail.AutoSize = true;

            pnlChatHeader.Controls.Add(lblActiveName);
            pnlChatHeader.Controls.Add(lblActiveDetail);

            lstMessages = new DoubleBufferedListBox();
            lstMessages.Dock = DockStyle.Fill;
            lstMessages.BackColor = clrChatBg;
            lstMessages.ForeColor = clrTextPrimary;
            lstMessages.BorderStyle = BorderStyle.None;
            lstMessages.DrawMode = DrawMode.OwnerDrawVariable;
            lstMessages.MeasureItem += LstMessages_MeasureItem;
            lstMessages.DrawItem += LstMessages_DrawItem;

            pnlInput = new Panel();
            pnlInput.Dock = DockStyle.Bottom;
            pnlInput.Height = 52;
            pnlInput.BackColor = clrHeader;

            txtInput = new TextBox();
            txtInput.Multiline = true;
            txtInput.Location = new Point(10, 8);
            txtInput.Width = 370;
            txtInput.Height = 36;
            txtInput.BackColor = clrSelected;
            txtInput.ForeColor = clrTextPrimary;
            txtInput.BorderStyle = BorderStyle.FixedSingle;
            txtInput.Font = new Font("Segoe UI", 9.5f);
            txtInput.Anchor = AnchorStyles.Left | AnchorStyles.Right | AnchorStyles.Top;
            txtInput.KeyDown += TxtInput_KeyDown;

            btnSend = new Button();
            btnSend.Text = "Kirim";
            btnSend.Width = 65;
            btnSend.Height = 36;
            btnSend.Location = new Point(390, 8);
            btnSend.Anchor = AnchorStyles.Right | AnchorStyles.Top;
            btnSend.BackColor = clrAccent;
            btnSend.ForeColor = Color.White;
            btnSend.FlatStyle = FlatStyle.Flat;
            btnSend.FlatAppearance.BorderSize = 0;
            btnSend.Font = new Font("Segoe UI", 9.5f, FontStyle.Bold);
            btnSend.Click += (s, e) => SendActiveMessage();

            pnlInput.Controls.Add(txtInput);
            pnlInput.Controls.Add(btnSend);

            pnlChat.Controls.Add(lstMessages);
            pnlChat.Controls.Add(pnlChatHeader);
            pnlChat.Controls.Add(pnlInput);

            pnlWhatsApp.Controls.Add(pnlChat);
            pnlWhatsApp.Controls.Add(pnlContacts);

            // Add main panels
            this.Controls.Add(pnlWhatsApp);
            this.Controls.Add(pnlPlatforms);
            this.Controls.Add(pnlTopBar);

            // Global Escape key panic handler
            this.KeyDown += (s, e) => {
                if (e.KeyCode == Keys.Escape)
                {
                    this.WindowState = FormWindowState.Minimized;
                }
            };
        }

        private Panel CreatePlatformCard(string title, string status, string desc, Color accent, string btnText, EventHandler onClick)
        {
            Panel card = new Panel();
            card.Width = 670;
            card.Height = 115;
            card.BackColor = clrHeader;

            Label lblTitle = new Label();
            lblTitle.Text = title;
            lblTitle.Font = new Font("Segoe UI", 11f, FontStyle.Bold);
            lblTitle.ForeColor = accent;
            lblTitle.Location = new Point(14, 12);
            lblTitle.AutoSize = true;

            Label lblStatus = new Label();
            lblStatus.Text = status;
            lblStatus.Font = new Font("Segoe UI", 8.5f, FontStyle.Italic);
            lblStatus.ForeColor = clrTextMuted;
            lblStatus.Location = new Point(16, 36);
            lblStatus.AutoSize = true;

            Label lblDesc = new Label();
            lblDesc.Text = desc;
            lblDesc.Font = new Font("Segoe UI", 9f);
            lblDesc.ForeColor = clrTextPrimary;
            lblDesc.Location = new Point(16, 58);
            lblDesc.AutoSize = true;

            Button btn = new Button();
            btn.Text = btnText;
            btn.Width = 145;
            btn.Height = 32;
            btn.Location = new Point(505, 40);
            btn.BackColor = accent;
            btn.ForeColor = Color.White;
            btn.FlatStyle = FlatStyle.Flat;
            btn.FlatAppearance.BorderSize = 0;
            btn.Font = new Font("Segoe UI", 9f, FontStyle.Bold);
            btn.Click += onClick;

            card.Controls.Add(lblTitle);
            card.Controls.Add(lblStatus);
            card.Controls.Add(lblDesc);
            card.Controls.Add(btn);
            return card;
        }

        private Button CreateDarkButton(string text, int width, int height)
        {
            Button btn = new Button();
            btn.Text = text;
            btn.Width = width;
            btn.Height = height;
            btn.BackColor = clrSelected;
            btn.ForeColor = clrTextPrimary;
            btn.FlatStyle = FlatStyle.Flat;
            btn.FlatAppearance.BorderSize = 0;
            btn.Font = new Font("Segoe UI", 8.5f);
            return btn;
        }

        // -------------------------------------------------------------
        // STEALTH AUTO-DIMMING & BACKGROUND TIMERS
        // -------------------------------------------------------------
        private void SetupTimers()
        {
            // Auto-dimming timer (ticks every 50ms for silky smooth fade)
            tmrStealth = new System.Windows.Forms.Timer();
            tmrStealth.Interval = 50;
            tmrStealth.Tick += (s, e) => {
                Point cursor = Cursor.Position;
                bool isHovered = this.Bounds.Contains(cursor);
                bool isFocused = this.ContainsFocus;

                double target = (isHovered || isFocused) ? 1.0 : idleOpacity;

                if (Math.Abs(this.Opacity - target) > 0.01)
                {
                    if (this.Opacity < target)
                    {
                        this.Opacity = Math.Min(target, this.Opacity + 0.12);
                    }
                    else
                    {
                        this.Opacity = Math.Max(target, this.Opacity - 0.05);
                    }
                }
            };
            tmrStealth.Start();

            // Background data polling timer (every 1.5s)
            tmrSync = new System.Windows.Forms.Timer();
            tmrSync.Interval = 1500;
            tmrSync.Tick += (s, e) => TriggerSync();
            tmrSync.Start();
        }

        private void TogglePlatformSelector()
        {
            if (pnlPlatforms.Visible)
            {
                pnlPlatforms.Visible = false;
                pnlWhatsApp.Visible = true;
            }
            else
            {
                pnlPlatforms.Visible = true;
                pnlWhatsApp.Visible = false;
            }
        }

        private void ShowWhatsAppView()
        {
            pnlPlatforms.Visible = false;
            pnlWhatsApp.Visible = true;
            TriggerSync();
        }

        private void ToggleMiniMode()
        {
            pnlContacts.Visible = !pnlContacts.Visible;
            if (!pnlContacts.Visible)
            {
                this.Width = 420;
                btnMiniToggle.Text = "📐 Full";
            }
            else
            {
                this.Width = 740;
                btnMiniToggle.Text = "📐 Mini";
            }
        }

        // -------------------------------------------------------------
        // HTTP API COMMUNICATION
        // -------------------------------------------------------------
        private void TriggerSync()
        {
            if (isSyncing) return;
            isSyncing = true;

            ThreadPool.QueueUserWorkItem(delegate {
                try
                {
                    // 1. Fetch Channels
                    string jsonChannels = HttpGet(API_URL + "/api/channels");
                    JsonValue parsed = MiniJson.Parse(jsonChannels);
                    List<ChannelItem> freshList = new List<ChannelItem>();

                    foreach (JsonValue ch in parsed.AsList())
                    {
                        freshList.Add(new ChannelItem
                        {
                            Id = ch["id"].AsString(),
                            RawId = ch["rawId"].AsString(),
                            DisplayName = ch["displayName"].AsString(),
                            Platform = ch["platform"].AsString(),
                            IsGroup = ch["isGroup"].AsBool(),
                            Timestamp = ch["timestamp"].AsLong()
                        });
                    }

                    // 2. Fetch Active Channel Messages
                    string activeRawId = "";
                    if (activeChannel != null) activeRawId = activeChannel.RawId;

                    string jsonMsgs = HttpGet(API_URL + "/api/messages?channelId=" + Uri.EscapeDataString(activeRawId));
                    JsonValue parsedMsgs = MiniJson.Parse(jsonMsgs);
                    List<MessageItem> freshMsgs = new List<MessageItem>();

                    foreach (JsonValue m in parsedMsgs.AsList())
                    {
                        freshMsgs.Add(new MessageItem
                        {
                            Source = m["source"].AsString(),
                            ChannelId = m["channelId"].AsString(),
                            ChannelName = m["channelName"].AsString(),
                            Sender = m["sender"].AsString(),
                            IsMe = m["isMe"].AsBool(),
                            IsGroup = m["isGroup"].AsBool(),
                            Text = m["text"].AsString(),
                            Timestamp = m["timestamp"].AsLong()
                        });
                    }

                    // 3. Update UI on Main Thread
                    this.BeginInvoke((MethodInvoker)delegate {
                        UpdateChannelsUI(freshList);
                        UpdateMessagesUI(freshMsgs);
                        isSyncing = false;
                    });
                }
                catch
                {
                    isSyncing = false;
                }
            });
        }

        private void UpdateChannelsUI(List<ChannelItem> freshList)
        {
            if (freshList == null || freshList.Count == 0)
            {
                lblContactCount.Text = "0 kontak terdeteksi";
                return;
            }

            allChannels = freshList;
            lblContactCount.Text = string.Format("Total {0} kontak tersinkronisasi", allChannels.Count);

            // Populate list if empty or count mismatch
            string filter = (txtSearch.Text == "Cari kontak / nomor...") ? "" : txtSearch.Text.Trim();
            FilterContacts(filter);

            // Auto-select first channel if none active
            if (activeChannel == null && lstContacts.Items.Count > 0)
            {
                lstContacts.SelectedIndex = 0;
            }
        }

        private void FilterContacts(string query)
        {
            string q = query.ToLower();
            lstContacts.BeginUpdate();
            lstContacts.Items.Clear();

            foreach (ChannelItem c in allChannels)
            {
                if (string.IsNullOrEmpty(q) || c.DisplayName.ToLower().Contains(q) || c.RawId.ToLower().Contains(q))
                {
                    lstContacts.Items.Add(c);
                }
            }

            // Restore selection if active channel is present
            if (activeChannel != null)
            {
                for (int i = 0; i < lstContacts.Items.Count; i++)
                {
                    ChannelItem itm = lstContacts.Items[i] as ChannelItem;
                    if (itm != null && itm.RawId == activeChannel.RawId)
                    {
                        lstContacts.SelectedIndex = i;
                        break;
                    }
                }
            }

            lstContacts.EndUpdate();
        }

        private void UpdateMessagesUI(List<MessageItem> freshMsgs)
        {
            if (freshMsgs == null) return;

            // Only refresh if message count or content changed
            if (freshMsgs.Count != currentMessages.Count)
            {
                currentMessages = freshMsgs;
                lstMessages.BeginUpdate();
                lstMessages.Items.Clear();

                foreach (MessageItem m in currentMessages)
                {
                    lstMessages.Items.Add(m);
                }

                lstMessages.EndUpdate();

                // Auto-scroll to latest message
                if (lstMessages.Items.Count > 0)
                {
                    lstMessages.TopIndex = lstMessages.Items.Count - 1;
                }
            }
        }

        private void LstContacts_SelectedIndexChanged(object sender, EventArgs e)
        {
            ChannelItem sel = lstContacts.SelectedItem as ChannelItem;
            if (sel != null && sel != activeChannel)
            {
                activeChannel = sel;
                lblActiveName.Text = sel.DisplayName;
                lblActiveDetail.Text = string.Format("{0} • {1}", sel.RawId, sel.IsGroup ? "Grup WhatsApp" : "Chat Personal");

                // Notify backend of channel switch
                ThreadPool.QueueUserWorkItem(delegate {
                    HttpPost(API_URL + "/api/select", string.Format("{{\"channelId\":\"{0}\"}}", sel.RawId));
                    TriggerSync();
                });
            }
        }

        private void TxtInput_KeyDown(object sender, KeyEventArgs e)
        {
            if (e.KeyCode == Keys.Enter && !e.Shift)
            {
                e.SuppressKeyPress = true;
                SendActiveMessage();
            }
            else if (e.KeyCode == Keys.Escape)
            {
                this.WindowState = FormWindowState.Minimized;
            }
        }

        private void SendActiveMessage()
        {
            string text = txtInput.Text.Trim();
            if (string.IsNullOrEmpty(text)) return;

            txtInput.Text = "";

            ThreadPool.QueueUserWorkItem(delegate {
                try
                {
                    string safeText = text.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", "\\n").Replace("\r", "");
                    HttpPost(API_URL + "/api/send", string.Format("{{\"text\":\"{0}\"}}", safeText));
                    Thread.Sleep(200);
                    TriggerSync();
                }
                catch { }
            });
        }

        private void OnNewChatClick()
        {
            using (Form prompt = new Form())
            {
                prompt.Width = 360;
                prompt.Height = 180;
                prompt.FormBorderStyle = FormBorderStyle.FixedDialog;
                prompt.Text = "Chat Nomor WhatsApp Baru";
                prompt.StartPosition = FormStartPosition.CenterParent;
                prompt.BackColor = clrBgDark;
                prompt.ForeColor = clrTextPrimary;

                Label lbl = new Label() { Left = 16, Top = 16, Width = 310, Text = "Masukkan Nomor HP WhatsApp (contoh: 0812345678):" };
                TextBox tb = new TextBox() { Left = 16, Top = 42, Width = 310, BackColor = clrHeader, ForeColor = clrTextPrimary, BorderStyle = BorderStyle.FixedSingle };
                Button btnOk = new Button() { Text = "Mulai Chat", Left = 16, Width = 150, Top = 80, DialogResult = DialogResult.OK, BackColor = clrAccent, ForeColor = Color.White, FlatStyle = FlatStyle.Flat };
                Button btnCancel = new Button() { Text = "Batal", Left = 176, Width = 150, Top = 80, DialogResult = DialogResult.Cancel, BackColor = clrSelected, ForeColor = clrTextPrimary, FlatStyle = FlatStyle.Flat };

                prompt.Controls.Add(lbl);
                prompt.Controls.Add(tb);
                prompt.Controls.Add(btnOk);
                prompt.Controls.Add(btnCancel);
                prompt.AcceptButton = btnOk;
                prompt.CancelButton = btnCancel;

                if (prompt.ShowDialog(this) == DialogResult.OK)
                {
                    string num = tb.Text.Trim();
                    if (!string.IsNullOrEmpty(num))
                    {
                        ThreadPool.QueueUserWorkItem(delegate {
                            HttpPost(API_URL + "/api/sendto", string.Format("{{\"target\":\"{0}\",\"text\":\"Halo\"}}", num));
                            Thread.Sleep(400);
                            TriggerSync();
                        });
                    }
                }
            }
        }

        private void OnResyncClick()
        {
            lblContactCount.Text = "Menyinkronkan kontak dari server WhatsApp...";
            ThreadPool.QueueUserWorkItem(delegate {
                try
                {
                    HttpPost(API_URL + "/api/resync", "{}");
                    Thread.Sleep(800);
                    TriggerSync();
                }
                catch { }
            });
        }

        // -------------------------------------------------------------
        // CUSTOM DRAWING: CONTACT LIST ITEMS
        // -------------------------------------------------------------
        private void LstContacts_DrawItem(object sender, DrawItemEventArgs e)
        {
            if (e.Index < 0 || e.Index >= lstContacts.Items.Count) return;
            ChannelItem item = lstContacts.Items[e.Index] as ChannelItem;
            if (item == null) return;

            Graphics g = e.Graphics;
            bool isSelected = (e.State & DrawItemState.Selected) == DrawItemState.Selected;

            // Background
            using (SolidBrush bgBrush = new SolidBrush(isSelected ? clrSelected : clrBgDark))
            {
                g.FillRectangle(bgBrush, e.Bounds);
            }

            // Avatar Icon Circle
            Rectangle avatarRect = new Rectangle(e.Bounds.Left + 8, e.Bounds.Top + 8, 36, 36);
            using (SolidBrush avBrush = new SolidBrush(item.IsGroup ? Color.FromArgb(0, 120, 100) : Color.FromArgb(40, 60, 75)))
            {
                g.FillEllipse(avBrush, avatarRect);
            }

            string initial = item.DisplayName.Length > 0 ? item.DisplayName.Substring(0, 1).ToUpper() : "?";
            using (Font avFont = new Font("Segoe UI", 12f, FontStyle.Bold))
            using (SolidBrush avTxt = new SolidBrush(Color.White))
            {
                SizeF sz = g.MeasureString(initial, avFont);
                g.DrawString(initial, avFont, avTxt, avatarRect.Left + (avatarRect.Width - sz.Width) / 2, avatarRect.Top + (avatarRect.Height - sz.Height) / 2);
            }

            // Contact Name
            using (Font nameFont = new Font("Segoe UI", 9.5f, FontStyle.Bold))
            using (SolidBrush nameBrush = new SolidBrush(isSelected ? clrAccent : clrTextPrimary))
            {
                g.DrawString(item.DisplayName, nameFont, nameBrush, e.Bounds.Left + 52, e.Bounds.Top + 8);
            }

            // Subtitle / JID preview
            using (Font subFont = new Font("Segoe UI", 8f))
            using (SolidBrush subBrush = new SolidBrush(clrTextMuted))
            {
                string info = item.IsGroup ? "[Grup]" : item.RawId.Split('@')[0];
                g.DrawString(info, subFont, subBrush, e.Bounds.Left + 52, e.Bounds.Top + 28);
            }

            // Bottom Separator Line
            using (Pen sepPen = new Pen(Color.FromArgb(25, 38, 45)))
            {
                g.DrawLine(sepPen, e.Bounds.Left + 52, e.Bounds.Bottom - 1, e.Bounds.Right, e.Bounds.Bottom - 1);
            }
        }

        // -------------------------------------------------------------
        // CUSTOM DRAWING: SPEECH BUBBLES IN MESSAGE LIST
        // -------------------------------------------------------------
        private void LstMessages_MeasureItem(object sender, MeasureItemEventArgs e)
        {
            if (e.Index < 0 || e.Index >= lstMessages.Items.Count) return;
            MessageItem msg = lstMessages.Items[e.Index] as MessageItem;
            if (msg == null) return;

            int maxTextWidth = Math.Max(180, (int)(lstMessages.Width * 0.70));
            using (Font font = new Font("Segoe UI", 9.5f))
            {
                SizeF sz = e.Graphics.MeasureString(msg.Text, font, maxTextWidth);
                e.ItemHeight = Math.Max(44, (int)sz.Height + 28);
            }
        }

        private void LstMessages_DrawItem(object sender, DrawItemEventArgs e)
        {
            if (e.Index < 0 || e.Index >= lstMessages.Items.Count) return;
            MessageItem msg = lstMessages.Items[e.Index] as MessageItem;
            if (msg == null) return;

            Graphics g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;

            // Clear row background
            using (SolidBrush bgBrush = new SolidBrush(clrChatBg))
            {
                g.FillRectangle(bgBrush, e.Bounds);
            }

            int maxBubbleWidth = Math.Max(180, (int)(lstMessages.Width * 0.70));
            Font textFont = new Font("Segoe UI", 9.5f);
            SizeF textSz = g.MeasureString(msg.Text, textFont, maxBubbleWidth);

            int bubbleWidth = Math.Max(120, (int)textSz.Width + 24);
            int bubbleHeight = Math.Max(36, (int)textSz.Height + 22);

            Rectangle bubbleRect;
            Color bubbleColor;

            if (msg.IsMe)
            {
                // Outgoing message (Right-aligned, WhatsApp Dark Green)
                bubbleRect = new Rectangle(e.Bounds.Right - bubbleWidth - 14, e.Bounds.Top + 3, bubbleWidth, bubbleHeight);
                bubbleColor = clrBubbleMe;
            }
            else
            {
                // Incoming message (Left-aligned, WhatsApp Dark Gray/Teal)
                bubbleRect = new Rectangle(e.Bounds.Left + 14, e.Bounds.Top + 3, bubbleWidth, bubbleHeight);
                bubbleColor = clrBubbleOther;
            }

            // Draw Rounded Message Bubble
            using (GraphicsPath path = CreateRoundedRectangle(bubbleRect, 8))
            using (SolidBrush bBrush = new SolidBrush(bubbleColor))
            {
                g.FillPath(bBrush, path);
            }

            // Draw Sender Name if incoming
            int textTop = bubbleRect.Top + 6;
            if (!msg.IsMe && !string.IsNullOrEmpty(msg.Sender) && msg.Sender != "You")
            {
                using (Font senderFont = new Font("Segoe UI", 8f, FontStyle.Bold))
                using (SolidBrush senderBrush = new SolidBrush(clrAccent))
                {
                    g.DrawString(msg.Sender, senderFont, senderBrush, bubbleRect.Left + 10, textTop);
                    textTop += 14;
                }
            }

            // Draw Message Text
            Rectangle textRect = new Rectangle(bubbleRect.Left + 10, textTop, bubbleRect.Width - 16, (int)textSz.Height + 4);
            using (SolidBrush textBrush = new SolidBrush(clrTextPrimary))
            {
                g.DrawString(msg.Text, textFont, textBrush, textRect);
            }

            // Draw Timestamp at bottom right of bubble
            if (msg.Timestamp > 0)
            {
                DateTime dt = new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc).AddMilliseconds(msg.Timestamp).ToLocalTime();
                string timeStr = dt.ToString("HH:mm");
                using (Font timeFont = new Font("Segoe UI", 7.5f))
                using (SolidBrush timeBrush = new SolidBrush(Color.FromArgb(180, 195, 205)))
                {
                    SizeF timeSz = g.MeasureString(timeStr, timeFont);
                    g.DrawString(timeStr, timeFont, timeBrush, bubbleRect.Right - timeSz.Width - 6, bubbleRect.Bottom - timeSz.Height - 3);
                }
            }
        }

        private GraphicsPath CreateRoundedRectangle(Rectangle rect, int radius)
        {
            GraphicsPath path = new GraphicsPath();
            int d = radius * 2;
            path.AddArc(rect.X, rect.Y, d, d, 180, 90);
            path.AddArc(rect.Right - d, rect.Y, d, d, 270, 90);
            path.AddArc(rect.Right - d, rect.Bottom - d, d, d, 0, 90);
            path.AddArc(rect.X, rect.Bottom - d, d, d, 90, 90);
            path.CloseFigure();
            return path;
        }

        // -------------------------------------------------------------
        // MINIMAL HTTP REQUEST HELPERS
        // -------------------------------------------------------------
        private static string HttpGet(string url)
        {
            HttpWebRequest req = (HttpWebRequest)WebRequest.Create(url);
            req.Method = "GET";
            req.Timeout = 2500;
            using (HttpWebResponse res = (HttpWebResponse)req.GetResponse())
            using (StreamReader reader = new StreamReader(res.GetResponseStream(), Encoding.UTF8))
            {
                return reader.ReadToEnd();
            }
        }

        private static string HttpPost(string url, string jsonBody)
        {
            byte[] bytes = Encoding.UTF8.GetBytes(jsonBody);
            HttpWebRequest req = (HttpWebRequest)WebRequest.Create(url);
            req.Method = "POST";
            req.ContentType = "application/json";
            req.ContentLength = bytes.Length;
            req.Timeout = 2500;
            using (Stream st = req.GetRequestStream())
            {
                st.Write(bytes, 0, bytes.Length);
            }
            using (HttpWebResponse res = (HttpWebResponse)req.GetResponse())
            using (StreamReader reader = new StreamReader(res.GetResponseStream(), Encoding.UTF8))
            {
                return reader.ReadToEnd();
            }
        }

        // Override Escape globally inside the form
        protected override bool ProcessCmdKey(ref Message msg, Keys keyData)
        {
            if (keyData == Keys.Escape)
            {
                this.WindowState = FormWindowState.Minimized;
                return true;
            }
            return base.ProcessCmdKey(ref msg, keyData);
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
