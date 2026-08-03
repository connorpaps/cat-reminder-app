// Resolves an asset path (e.g. "assets/cats/default/idle.png") to a usable URL.
// In dev the renderer is served by Vite (public/ is the document root); in
// packaged builds the assets live under process.resourcesPath (the assetBaseUrl
// passed by the main process) and the renderer page is a file:// document.
export function assetUrl(path: string, baseUrl?: string): string {
  if (baseUrl) return baseUrl.replace(/\/+$/, '') + '/' + path
  return (window.location.protocol === 'file:' ? './' : '/') + path
}
