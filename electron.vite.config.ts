import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

const rootDir = process.cwd()

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
    plugins: [react()],
    publicDir: resolve(rootDir, 'public')
  }
})
