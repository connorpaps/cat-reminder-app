import { BrowserWindow } from 'electron'
import { join } from 'node:path'

// Main/preload bundles are explicitly emitted as CommonJS so __dirname resolves
// consistently in both development and packaged Electron builds.
export function secureWebPreferences(preloadName = 'index'): Electron.WebPreferences {
  return {
    preload: join(__dirname, `../preload/${preloadName}.js`),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true
  }
}

export async function loadRenderer(window: BrowserWindow, query = ''): Promise<void> {
  const devUrl = process.env.ELECTRON_RENDERER_URL
  if (devUrl) {
    await window.loadURL(`${devUrl}${query}`)
    return
  }
  await window.loadFile(join(__dirname, '../renderer/index.html'), {
    query: query ? Object.fromEntries(new URLSearchParams(query.slice(1))) : undefined
  })
}
