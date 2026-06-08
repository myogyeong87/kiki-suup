// Run: node scripts/generate-icons.mjs
// Requires: npm install canvas (optional) — falls back to creating placeholder PNGs
import { createCanvas } from 'canvas'
import fs from 'fs'
import path from 'path'

const outDir = path.join(process.cwd(), 'public', 'icons')
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

function makeIcon(size) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')

  // background gradient
  const grad = ctx.createLinearGradient(0, 0, size, size)
  grad.addColorStop(0, '#7c3aed')
  grad.addColorStop(1, '#a78bfa')
  ctx.fillStyle = grad
  const r = size * 0.2
  ctx.beginPath()
  ctx.moveTo(r, 0)
  ctx.lineTo(size - r, 0)
  ctx.quadraticCurveTo(size, 0, size, r)
  ctx.lineTo(size, size - r)
  ctx.quadraticCurveTo(size, size, size - r, size)
  ctx.lineTo(r, size)
  ctx.quadraticCurveTo(0, size, 0, size - r)
  ctx.lineTo(0, r)
  ctx.quadraticCurveTo(0, 0, r, 0)
  ctx.closePath()
  ctx.fill()

  // emoji
  ctx.font = `${size * 0.58}px serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('🧹', size / 2, size / 2 + size * 0.03)

  return canvas.toBuffer('image/png')
}

for (const size of [192, 512]) {
  const buf = makeIcon(size)
  fs.writeFileSync(path.join(outDir, `icon-${size}.png`), buf)
  console.log(`Created icon-${size}.png`)
}
