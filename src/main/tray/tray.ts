import { app, Menu, nativeImage, Tray } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { showPopupWindow } from '../windows/popup-window'

let tray: Tray | undefined

function resolveTrayIconPath(): string {
  const candidates = [
    join(app.getAppPath(), 'public', 'assets', 'cats', 'default', 'idle.png'),
    join(process.resourcesPath ?? '', 'assets', 'cats', 'default', 'idle.png')
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return candidates[0]
}

function createTrayIcon(): Electron.NativeImage {
  const iconPath = resolveTrayIconPath()
  const fullImage = nativeImage.createFromPath(iconPath)
  if (fullImage.isEmpty()) {
    return nativeImage.createEmpty()
  }
  // idle.png is a 384×64 sprite sheet (6 frames × 64×64). Crop the first frame for the tray.
  const frame = fullImage.crop({ x: 0, y: 0, width: 64, height: 64 })
  return frame.resize({ width: 32, height: 32 })
}

export function createTray(): Tray {
  if (tray) return tray
  tray = new Tray(createTrayIcon())
  tray.setToolTip('Cat Reminder')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Quit', click: () => app.quit() }
  ]))
  tray.on('click', () => showPopupWindow())
  return tray
}
