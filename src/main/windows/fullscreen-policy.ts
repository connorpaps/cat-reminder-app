import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { FullscreenPolicy } from '../../shared/types/preferences'

const execFileAsync = promisify(execFile)
const probeScript = String.raw`
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class CatReminderFullscreenProbe {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
  [StructLayout(LayoutKind.Sequential)] public struct MONITORINFO { public int cbSize; public RECT rcMonitor; public RECT rcWork; public uint dwFlags; }
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] public static extern IntPtr MonitorFromWindow(IntPtr hWnd, uint flags);
  [DllImport("user32.dll", CharSet=CharSet.Auto)] public static extern bool GetMonitorInfo(IntPtr hMonitor, ref MONITORINFO info);
  public static bool IsFullscreen() {
    var window = GetForegroundWindow();
    if (window == IntPtr.Zero) return false;
    RECT windowRect;
    var monitor = MonitorFromWindow(window, 2);
    var info = new MONITORINFO();
    info.cbSize = Marshal.SizeOf(typeof(MONITORINFO));
    if (monitor == IntPtr.Zero || !GetWindowRect(window, out windowRect) || !GetMonitorInfo(monitor, ref info)) return false;
    return windowRect.Left <= info.rcMonitor.Left && windowRect.Top <= info.rcMonitor.Top &&
      windowRect.Right >= info.rcMonitor.Right && windowRect.Bottom >= info.rcMonitor.Bottom;
  }
}
'@
if ([CatReminderFullscreenProbe]::IsFullscreen()) { '1' } else { '0' }
`

let cachedAt = 0
let cachedValue = false

async function detectFullscreen(): Promise<boolean | null> {
  if (process.platform !== 'win32') return false
  if (Date.now() - cachedAt < 1000) return cachedValue
  try {
    const result = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', probeScript], { timeout: 750, windowsHide: true, maxBuffer: 16 * 1024 })
    cachedValue = result.stdout.trim().endsWith('1')
  } catch {
    cachedAt = Date.now()
    return null
  }
  cachedAt = Date.now()
  return cachedValue
}

export async function shouldShowOverlay(policy: FullscreenPolicy): Promise<boolean> {
  if (policy === 'show') return true
  if (policy === 'suppress') return false
  const fullscreen = await detectFullscreen()
  // If the probe cannot determine state (null), default to showing the overlay
  // rather than silently suppressing all reminders.
  return fullscreen !== true
}
