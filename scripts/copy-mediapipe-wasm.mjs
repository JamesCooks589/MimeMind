// Copies MediaPipe's WASM runtime from node_modules into public/ so the app
// serves it from its own domain instead of a third-party CDN. This keeps the
// runtime version-locked to the installed npm package.
import { cpSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const src = resolve(root, 'node_modules/@mediapipe/tasks-vision/wasm')
const dest = resolve(root, 'public/mediapipe/wasm')

if (!existsSync(src)) {
  console.error(`[copy-mediapipe-wasm] Not found: ${src}. Run npm install first.`)
  process.exit(1)
}
cpSync(src, dest, { recursive: true })
console.log('[copy-mediapipe-wasm] Copied MediaPipe WASM to public/mediapipe/wasm')
