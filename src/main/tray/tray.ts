import { app, Menu, nativeImage, Tray } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { CAT_IDS } from '../../shared/animation'
import { showPopupWindow } from '../windows/popup-window'

let tray: Tray | undefined

function resolveTrayIconPath(catId: string): string {
  // Only known cat ids are accepted (preferences could theoretically hold a
  // hand-edited value, so never interpolate it into a filesystem path unchecked).
  const safeId = (CAT_IDS as string[]).includes(catId) ? catId : 'default'
  const candidates = [
    join(app.getAppPath(), 'public', 'assets', 'cats', safeId, 'idle.png'),
    join(process.resourcesPath ?? '', 'assets', 'cats', safeId, 'idle.png')
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return candidates[0]
}

function createTrayIcon(catId = 'default'): Electron.NativeImage {
  const iconPath = resolveTrayIconPath(catId)
  const fullImage = nativeImage.createFromPath(iconPath)
  if (fullImage.isEmpty()) {
    return nativeImage.createEmpty()
  }
  // idle.png is a 384×64 sprite sheet (6 frames × 64×64). Crop the first frame for the tray.
  const frame = fullImage.crop({ x: 0, y: 0, width: 64, height: 64 })
  return frame.resize({ width: 32, height: 32 })
}

export function createTray(catId = 'default'): Tray {
  if (tray) return tray
  tray = new Tray(createTrayIcon(catId))
  tray.setToolTip('Cat Reminder')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Quit', click: () => app.quit() }
  ]))
  tray.on('click', () => showPopupWindow())
  return tray
}

/** Swaps the tray icon to the selected cat (used when the cat preference changes). */
export function updateTrayIcon(catId: string): void {
  if (tray && !tray.isDestroyed()) tray.setImage(createTrayIcon(catId))
}
