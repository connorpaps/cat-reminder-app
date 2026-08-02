import { BrowserWindow, screen } from 'electron'
import { loadRenderer, secureWebPreferences } from './window-utils'

const POPUP_WIDTH = 274
const POPUP_HEIGHT = 416

let popup: BrowserWindow | undefined
let lastCreatedAt = 0

function taskbarAnchor(): { x: number; y: number } {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const { x, y, width, height } = display.workArea
  return { x: x + width - POPUP_WIDTH - 12, y: y + height - POPUP_HEIGHT - 8 }
}

export function showPopupWindow(): void {
  // Debounce accidental double-clicks on the tray icon.
  if (Date.now() - lastCreatedAt < 300) return
  if (popup && !popup.isDestroyed()) {
    if (popup.isVisible()) {
      popup.hide()
      return
    }
    const anchor = taskbarAnchor()
    popup.setBounds({ ...anchor, width: POPUP_WIDTH, height: POPUP_HEIGHT })
    popup.showInactive()
    return
  }

  const anchor = taskbarAnchor()
  popup = new BrowserWindow({
    x: anchor.x,
    y: anchor.y,
    width: POPUP_WIDTH,
    height: POPUP_HEIGHT,
    show: false,
    frame: false,
    hasShadow: false,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    transparent: true,
    webPreferences: secureWebPreferences('index')
  })

  popup.setAlwaysOnTop(true, 'pop-up-menu')
  popup.on('blur', () => popup?.hide())
  popup.on('closed', () => { popup = undefined })

  void loadRenderer(popup, '?popup=1').then(() => {
    popup?.showInactive()
    lastCreatedAt = Date.now()
  })
}

export function hidePopupWindow(): void {
  if (popup && !popup.isDestroyed()) popup.hide()
}
