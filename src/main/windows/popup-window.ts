import { BrowserWindow, screen } from 'electron'
import { loadRenderer, secureWebPreferences } from './window-utils'

const POPUP_WIDTH = 286
const POPUP_HEIGHT = 620

let popup: BrowserWindow | undefined
let lastCreatedAt = 0

function popupBounds(): { x: number; y: number; width: number; height: number } {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const { x, y, width, height } = display.workArea
  // Use the full comfortable height on normal displays, but never place the
  // popup above the work area on short laptop/remote-desktop displays.
  const popupHeight = Math.min(POPUP_HEIGHT, Math.max(1, height - 8))
  return {
    x: x + width - POPUP_WIDTH - 12,
    y: y + height - popupHeight - 8,
    width: POPUP_WIDTH,
    height: popupHeight
  }
}

export function showPopupWindow(): void {
  // Debounce accidental double-clicks on the tray icon.
  if (Date.now() - lastCreatedAt < 300) return
  if (popup && !popup.isDestroyed()) {
    if (popup.isVisible()) {
      popup.hide()
      return
    }
    popup.setBounds(popupBounds())
    popup.showInactive()
    return
  }

  const bounds = popupBounds()
  popup = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
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
  // Hardening: this window never opens child windows and never navigates away.
  popup.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  popup.webContents.on('will-navigate', (event) => event.preventDefault())
  popup.on('blur', () => popup?.hide())
  popup.on('closed', () => { popup = undefined })

  void loadRenderer(popup, '?popup=1').then(() => {
    popup?.showInactive()
    lastCreatedAt = Date.now()
  })
}

