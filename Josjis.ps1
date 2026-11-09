<#
.SYNOPSIS
  Josjis Native Compact Stealth Client
  Runs 100% official WhatsApp Web, Discord, and TikTok inside a lightweight native window
  with OS-level Auto-Opacity Ghost Mode and Panic Key.
#>

param(
    [string]$Platform = ""
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Clear-Host

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "       JOSJIS NATIVE STEALTH CLIENT (LIGHTWEIGHT)         " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "• 100% Akses SEMUA Chat (Menggunakan engine web resmi)" -ForegroundColor Gray
Write-Host "• Auto-Opacity Ghost Mode (Transparan saat mouse tidak menyentuh)" -ForegroundColor Gray
Write-Host "• Panic Key (Tekan Esc di mana saja untuk sembunyikan window)" -ForegroundColor Gray
Write-Host "----------------------------------------------------------" -ForegroundColor DarkGray

if (-not $Platform) {
    Write-Host "Pilih Platform yang ingin dibuka:" -ForegroundColor Yellow
    Write-Host "  [1] WhatsApp Web  (Semua chat pribadi, grup & media lengkap)" -ForegroundColor White
    Write-Host "  [2] Discord Web   (Server & Direct Messages)" -ForegroundColor White
    Write-Host "  [3] TikTok Web    (Direct Messages & Inbox)" -ForegroundColor White
    Write-Host ""
    $choice = Read-Host "Ketik pilihan [1-3] (Default: 1)"
    if (-not $choice) { $choice = "1" }
} else {
    $choice = $Platform
}

$targetUrl = "https://web.whatsapp.com"
$appName = "WhatsApp"

switch ($choice) {
    "2" {
        $targetUrl = "https://discord.com/app"
        $appName = "Discord"
    }
    "3" {
        $targetUrl = "https://www.tiktok.com/messages"
        $appName = "TikTok DM"
    }
    default {
        $targetUrl = "https://web.whatsapp.com"
        $appName = "WhatsApp"
    }
}

Write-Host "`n[+] Membuka $appName dalam mode compact native..." -ForegroundColor Green

# Find Edge or Chrome
$browserPath = ""
$edgePaths = @(
    "$env:ProgramFiles (x86)\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe"
)
foreach ($p in $edgePaths) {
    if (Test-Path $p) { $browserPath = $p; break }
}

if (-not $browserPath) {
    $chromePaths = @(
        "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
        "$env:ProgramFiles (x86)\Google\Chrome\Application\chrome.exe",
        "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
    )
    foreach ($p in $chromePaths) {
        if (Test-Path $p) { $browserPath = $p; break }
    }
}

if (-not $browserPath) {
    Write-Host "[!] Error: Tidak menemukan Microsoft Edge atau Google Chrome di komputer." -ForegroundColor Red
    pause
    exit 1
}

# Dedicated profile directory so login session is permanently remembered
$profileDir = Join-Path $env:LOCALAPPDATA "JosjisNativeProfile"
if (-not (Test-Path $profileDir)) {
    New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
}

# Launch standalone frameless App Mode (Compact 380x620)
$args = @(
    "--app=$targetUrl",
    "--window-size=380,620",
    "--user-data-dir=$profileDir",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding"
)

$proc = Start-Process -FilePath $browserPath -ArgumentList $args -PassThru

# Win32 API for OS-Level Transparency & Mouse Tracking
$win32Code = @"
using System;
using System.Runtime.InteropServices;

public class Win32 {
    [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT lpPoint);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    [DllImport("user32.dll")] public static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);
    [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr hWnd, int nIndex);
    [DllImport("user32.dll")] public static extern bool SetLayeredWindowAttributes(IntPtr hwnd, uint crKey, byte bAlpha, uint dwFlags);
    [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int vKey);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();

    public struct POINT { public int X; public int Y; }
    public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }

    public const int GWL_EXSTYLE = -20;
    public const int WS_EX_LAYERED = 0x80000;
    public const int LWA_ALPHA = 0x2;
    public const int SW_MINIMIZE = 6;
    public const int SW_RESTORE = 9;
}
"@

Add-Type -TypeDefinition $win32Code -ErrorAction SilentlyContinue

Write-Host "[+] Mengaktifkan fitur Auto-Opacity Ghost Mode & Panic Key (Esc)..." -ForegroundColor Cyan
Write-Host "    - Saat kursor mouse di luar jendela: jendela otomatis redup gelap (20% opacity)." -ForegroundColor Gray
Write-Host "    - Saat kursor mouse menyentuh jendela: terang normal 100%." -ForegroundColor Gray
Write-Host "    - Tekan Esc kapan saja: jendela langsung disembunyikan/minimize." -ForegroundColor Gray
Write-Host "`n(Jangan tutup jendela command prompt ini agar ghost mode tetap aktif)`n" -ForegroundColor DarkGray

# Wait for window to render and obtain HWND
$hwnd = [IntPtr]::Zero
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Milliseconds 300
    $hwnd = $proc.MainWindowHandle
    if ($hwnd -ne [IntPtr]::Zero) { break }
    # Try finding by process id
    $proc.Refresh()
}

if ($hwnd -ne [IntPtr]::Zero) {
    # Apply WS_EX_LAYERED style for native transparency
    $style = [Win32]::GetWindowLong($hwnd, [Win32]::GWL_EXSTYLE)
    [Win32]::SetWindowLong($hwnd, [Win32]::GWL_EXSTYLE, ($style -bor [Win32]::WS_EX_LAYERED)) | Out-Null
    [Win32]::SetLayeredWindowAttributes($hwnd, 0, 255, [Win32]::LWA_ALPHA) | Out-Null
}

$isDimmed = $false
$idleCounter = 0

# Monitoring loop
while (-not $proc.HasExited) {
    Start-Sleep -Milliseconds 120

    # Refresh hwnd if needed
    if ($hwnd -eq [IntPtr]::Zero) {
        $proc.Refresh()
        $hwnd = $proc.MainWindowHandle
        if ($hwnd -ne [IntPtr]::Zero) {
            $style = [Win32]::GetWindowLong($hwnd, [Win32]::GWL_EXSTYLE)
            [Win32]::SetWindowLong($hwnd, [Win32]::GWL_EXSTYLE, ($style -bor [Win32]::WS_EX_LAYERED)) | Out-Null
        }
        continue
    }

    # Panic Key (Esc = 0x1B)
    $escState = [Win32]::GetAsyncKeyState(0x1B)
    if ($escState -band 0x8000) {
        # Check if Josjis window is foreground
        $fg = [Win32]::GetForegroundWindow()
        if ($fg -eq $hwnd) {
            [Win32]::ShowWindow($hwnd, [Win32]::SW_MINIMIZE) | Out-Null
            Start-Sleep -Milliseconds 400
            continue
        }
    }

    # Get Cursor Position and Window Bounds
    $pt = New-Object Win32+POINT
    $rect = New-Object Win32+RECT
    [Win32]::GetCursorPos([ref]$pt) | Out-Null
    [Win32]::GetWindowRect($hwnd, [ref]$rect) | Out-Null

    # Check if mouse is hovering over the window
    $isHovering = ($pt.X -ge $rect.Left -and $pt.X -le $rect.Right -and $pt.Y -ge $rect.Top -and $pt.Y -le $rect.Bottom)

    if ($isHovering) {
        $idleCounter = 0
        if ($isDimmed) {
            # Brighten to 100% (255)
            [Win32]::SetLayeredWindowAttributes($hwnd, 0, 255, [Win32]::LWA_ALPHA) | Out-Null
            $isDimmed = $false
        }
    } else {
        $idleCounter++
        # Dim after ~600ms of mouse outside
        if ($idleCounter -gt 5 -and -not $isDimmed) {
            # Dim to 20% (51 / 255)
            [Win32]::SetLayeredWindowAttributes($hwnd, 0, 52, [Win32]::LWA_ALPHA) | Out-Null
            $isDimmed = $true
        }
    }
}
