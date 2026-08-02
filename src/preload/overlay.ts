import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('catOverlay', {
  onShow: (listener: (payload: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: unknown) => listener(payload)
    ipcRenderer.on('overlay:show', handler)
    return () => ipcRenderer.removeListener('overlay:show', handler)
  },
  action: (id: string, action: 'snooze' | 'dismiss' | 'complete') => ipcRenderer.send('overlay:action', id, action),
  ready: () => ipcRenderer.send('overlay:ready'),
  setIgnoreMouseEvents: (ignore: boolean) => ipcRenderer.send('overlay:set-ignore-mouse-events', ignore),
  animationComplete: (id: string) => ipcRenderer.send('overlay:animation-complete', id)
})
