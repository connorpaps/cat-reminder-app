import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

const rootDir = process.cwd()

// Inject a strict Content-Security-Policy into the PRODUCTION renderer HTML only.
// Dev builds are left untouched so Vite's react-refresh inline preamble works.
// `img-src file:` is required for packaged builds: the overlay loads cat/textbox
// sprites from process.resourcesPath via file:// URLs (assetBaseUrl).
// (Typed inline rather than `import type { Plugin } from 'vite'` — vite is only a
// transitive dependency of electron-vite, so the type import fails to resolve.)
const cspMetaTag = {
  name: 'inject-csp',
  apply: 'build' as const,
  transformIndexHtml(html: string): {
    html: string
    tags: Array<{ tag: string; attrs: Record<string, string>; injectTo: 'head-prepend' }>
  } {
    return {
      html,
      tags: [
        {
          tag: 'meta',
          attrs: {
            'http-equiv': 'Content-Security-Policy',
            content:
              "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: file:; media-src 'self' file:; object-src 'none'; base-uri 'none'; form-action 'none'"
          },
          injectTo: 'head-prepend'
        }
      ]
    }
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: resolve(rootDir, 'src/main/index.ts'),
        output: { format: 'cjs' }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(rootDir, 'src/preload/index.ts'),
          overlay: resolve(rootDir, 'src/preload/overlay.ts')
        },
        output: { format: 'cjs' }
      }
    }
  },
  renderer: {
    plugins: [react(), cspMetaTag],
    publicDir: resolve(rootDir, 'public')
  }
})
