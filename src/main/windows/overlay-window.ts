import { BrowserWindow, screen } from 'electron'
import type { OverlayReminder } from '../../shared/types/overlay'
import { loadRenderer, secureWebPreferences } from './window-utils'
import { shouldShowOverlay } from './fullscreen-policy'
import type { FullscreenPolicy } from '../../shared/types/preferences'

type ReadyState = {
  ready: boolean
  promise: Promise<void>
  resolve: () => void
}

function createReadyState(): ReadyState {
  let resolve!: () => void
  const promise = new Promise<void>((next) => { resolve = next })
  return { ready: false, promise, resolve }
}

let visualWindow: BrowserWindow | undefined
let visualState = createReadyState()
let overlayInitialization: Promise<void> | undefined

// Distance (px) from the bottom of the overlay window to the line the cat walks on.
// The display work area excludes the taskbar, so for a bottom-docked taskbar this
// equals the taskbar height and the cat's feet rest exactly on the taskbar's top edge.
// For any other layout (top/left/right-docked, auto-hide taskbar, or no taskbar) it
// falls back to the bottom of the work area so the cat always stays fully visible.
function catWalkBaseline(display: Electron.Display): number {
  const { bounds, workArea } = display
  return bounds.y + bounds.height - (workArea.y + workArea.height)
}

function resetReadyState(): void {
  visualState = createReadyState()
}

function destroyOverlayWindow(): void {
  visualWindow?.destroy()
  visualWindow = undefined
  resetReadyState()
}

export function markOverlayReady(senderId: number): void {
  if (visualWindow?.webContents.id !== senderId || visualState.ready) return
  visualState.ready = true
  visualState.resolve()
}

export function setOverlayIgnoreMouseEvents(senderId: number, ignore: boolean): void {
  if (!visualWindow || visualWindow.isDestroyed() || visualWindow.webContents.id !== senderId) return
  visualWindow.setIgnoreMouseEvents(ignore, { forward: true })
}

async function waitForReady(): Promise<void> {
  if (visualState.ready) return
  await Promise.race([
    visualState.promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('overlay renderer did not become ready')), 5_000))
  ])
}

async function createOverlayWindow(): Promise<void> {
  destroyOverlayWindow()
  try {
    const { bounds } = screen.getPrimaryDisplay()
    visualWindow = new BrowserWindow({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      show: false,
      transparent: true,
      frame: false,
      hasShadow: false,
      resizable: false,
      movable: false,
      focusable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      webPreferences: secureWebPreferences('overlay')
    })
    const currentWindow = visualWindow
    visualWindow.setAlwaysOnTop(true, 'floating')
    visualWindow.setIgnoreMouseEvents(true, { forward: true })
    visualWindow.on('closed', () => {
      // Electron destroys webContents before emitting `closed`; compare the
      // window object itself instead of reading properties from destroyed contents.
      if (visualWindow === currentWindow) {
        visualWindow = undefined
        resetReadyState()
      }
    })
    await loadRenderer(visualWindow, '?overlay=1')
    await waitForReady()
  } catch (error) {
    destroyOverlayWindow()
    throw error
  }
}

export async function showOverlay(payload: OverlayReminder, policy: FullscreenPolicy = 'respect'): Promise<boolean> {
  if (!(await shouldShowOverlay(policy))) return false

  if (!visualWindow || visualWindow.isDestroyed()) {
    overlayInitialization ??= createOverlayWindow().finally(() => { overlayInitialization = undefined })
    await overlayInitialization
  } else {
    await waitForReady()
  }

  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const bounds = display.bounds
  const nextPayload: OverlayReminder = {
    ...payload,
    animationStartedAt: payload.animationStartedAt ?? Date.now(),
    walkBaselineFromBottom: catWalkBaseline(display)
  }
  visualWindow!.setBounds({ x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height })
  visualWindow!.webContents.send('overlay:show', nextPayload)
  visualWindow!.setIgnoreMouseEvents(true, { forward: true })
  visualWindow!.showInactive()
  return true
}

export function hideOverlay(): void {
  if (!visualWindow || visualWindow.isDestroyed()) return
  visualWindow.setIgnoreMouseEvents(true, { forward: true })
  visualWindow.hide()
}

export function resetOverlayAfterFailure(): void {
  destroyOverlayWindow()
}
