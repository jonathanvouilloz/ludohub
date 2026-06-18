// Script jetable : rasterise static/icons/icon.svg vers les PNG du manifest PWA.
// Usage : node scripts/gen-icons.mjs  (nécessite sharp en devDep temporaire).
import sharp from 'sharp'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const iconsDir = join(root, 'static', 'icons')
const svg = readFileSync(join(iconsDir, 'icon.svg'))

const png = (size) => sharp(svg, { density: 384 }).resize(size, size)

await png(192).toFile(join(iconsDir, 'icon-192.png'))
await png(512).toFile(join(iconsDir, 'icon-512.png'))
await png(512).toFile(join(iconsDir, 'icon-maskable-512.png'))
// apple-touch-icon : fond opaque, pas de transparence (rendu carré arrondi par iOS).
await sharp(svg, { density: 384 })
  .resize(180, 180)
  .flatten({ background: '#0073e6' })
  .toFile(join(iconsDir, 'apple-touch-icon-180.png'))
// favicon (corrige la référence morte de app.html).
await png(48).toFile(join(root, 'static', 'favicon.png'))

console.log('Icons generated.')
