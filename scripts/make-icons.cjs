// Pure Node.js RGBA PNG generator — no dependencies
// Broom icon: mint gradient background + white broom shape
const fs   = require('fs')
const path = require('path')
const zlib = require('zlib')

// ── PNG helpers ────────────────────────────────────────────
function crc32(buf) {
  const t = []
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    t[i] = c
  }
  let crc = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) crc = t[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8)
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function pngChunk(type, data) {
  const tb = Buffer.from(type, 'ascii')
  const lb = Buffer.alloc(4); lb.writeUInt32BE(data.length)
  const cb = Buffer.concat([tb, data])
  const rb = Buffer.alloc(4); rb.writeUInt32BE(crc32(cb))
  return Buffer.concat([lb, cb, rb])
}

// ── Drawing helpers (operate on flat RGBA Uint8Array) ──────
function drawLine(rgba, size, x1, y1, x2, y2, thickness, r, g, b, a = 255) {
  const dx = x2 - x1, dy = y2 - y1
  const lenSq = dx * dx + dy * dy
  if (lenSq < 1) return
  const halfT = thickness / 2
  const pad   = halfT + 2

  const minX = Math.max(0, Math.floor(Math.min(x1, x2) - pad))
  const maxX = Math.min(size - 1, Math.ceil(Math.max(x1, x2) + pad))
  const minY = Math.max(0, Math.floor(Math.min(y1, y2) - pad))
  const maxY = Math.min(size - 1, Math.ceil(Math.max(y1, y2) + pad))

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x - x1, py = y - y1
      const tt = Math.max(0, Math.min(1, (px * dx + py * dy) / lenSq))
      const dist = Math.hypot(x - x1 - tt * dx, y - y1 - tt * dy)
      if (dist > halfT) continue
      const i = (y * size + x) * 4
      if (rgba[i + 3] === 0) continue // skip rounded-corner transparent pixels
      const fa = a / 255
      rgba[i]     = Math.round(rgba[i]     * (1 - fa) + r * fa)
      rgba[i + 1] = Math.round(rgba[i + 1] * (1 - fa) + g * fa)
      rgba[i + 2] = Math.round(rgba[i + 2] * (1 - fa) + b * fa)
      rgba[i + 3] = 255
    }
  }
}

function drawCircle(rgba, size, cx, cy, rad, r, g, b, a = 255) {
  const minX = Math.max(0, Math.floor(cx - rad - 1))
  const maxX = Math.min(size - 1, Math.ceil(cx + rad + 1))
  const minY = Math.max(0, Math.floor(cy - rad - 1))
  const maxY = Math.min(size - 1, Math.ceil(cy + rad + 1))
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (Math.hypot(x - cx, y - cy) > rad) continue
      const i = (y * size + x) * 4
      if (rgba[i + 3] === 0) continue
      const fa = a / 255
      rgba[i]     = Math.round(rgba[i]     * (1 - fa) + r * fa)
      rgba[i + 1] = Math.round(rgba[i + 1] * (1 - fa) + g * fa)
      rgba[i + 2] = Math.round(rgba[i + 2] * (1 - fa) + b * fa)
      rgba[i + 3] = 255
    }
  }
}

// ── Main icon generator ────────────────────────────────────
function createPNG(size) {
  const radius = Math.round(size * 0.22) // rounded corners

  // Mint gradient top→bottom
  const topC    = { r: 0x2d, g: 0x88, b: 0x80 }
  const bottomC = { r: 0x57, g: 0xbc, b: 0xb3 }

  const rgba = new Uint8Array(size * size * 4)

  // Gradient background + rounded corners
  for (let y = 0; y < size; y++) {
    const t  = y / (size - 1)
    const gr = Math.round(topC.r + (bottomC.r - topC.r) * t)
    const gg = Math.round(topC.g + (bottomC.g - topC.g) * t)
    const gb = Math.round(topC.b + (bottomC.b - topC.b) * t)
    for (let x = 0; x < size; x++) {
      const cx = Math.min(x, size - 1 - x)
      const cy = Math.min(y, size - 1 - y)
      let alpha = 255
      if (cx < radius && cy < radius) {
        const dx = radius - cx - 1, dy = radius - cy - 1
        alpha = Math.hypot(dx, dy) < radius ? 255 : 0
      }
      const i = (y * size + x) * 4
      rgba[i] = gr; rgba[i + 1] = gg; rgba[i + 2] = gb; rgba[i + 3] = alpha
    }
  }

  // All geometry is defined at 512×512, then scaled
  const S = (n) => n * size / 512

  // ── Broom handle (diagonal, top-right → middle-left) ──
  drawLine(rgba, size, S(355), S(88), S(182), S(318), S(38), 255, 255, 255, 248)

  // ── Binding band (slightly wider, semi-transparent teal, then white) ──
  drawLine(rgba, size, S(162), S(306), S(208), S(344), S(54), 0xb8, 0xe8, 0xe2, 155)
  drawLine(rgba, size, S(162), S(306), S(208), S(344), S(36), 255, 255, 255, 248)

  // ── Bristles fanning out from broom head ──
  const bx = S(185), by = S(320)
  const bristles = [
    [S(82),  S(440), 210],
    [S(132), S(452), 228],
    [S(187), S(458), 242],
    [S(242), S(452), 228],
    [S(292), S(440), 210],
  ]
  for (const [tx, ty, al] of bristles) {
    drawLine(rgba, size, bx, by, tx, ty, S(20), 255, 255, 255, al)
  }

  // ── Small sparkles near handle top ──
  drawCircle(rgba, size, S(390), S(142), S(9),  255, 255, 255, 172)
  drawCircle(rgba, size, S(418), S(175), S(6),  255, 255, 255, 150)
  drawCircle(rgba, size, S(424), S(128), S(7),  255, 255, 255, 162)

  // ── Pack into PNG raw (filter byte + RGBA rows) ────────
  const raw = Buffer.alloc(size * (1 + size * 4))
  for (let y = 0; y < size; y++) {
    const rowOff = y * (1 + size * 4)
    raw[rowOff] = 0 // filter: None
    for (let x = 0; x < size; x++) {
      const si = (y * size + x) * 4
      const di = rowOff + 1 + x * 4
      raw[di]     = rgba[si]
      raw[di + 1] = rgba[si + 1]
      raw[di + 2] = rgba[si + 2]
      raw[di + 3] = rgba[si + 3]
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6 // bit depth 8, RGBA

  const compressed = zlib.deflateSync(raw, { level: 9 })
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0))
  ])
}

// ── Output ─────────────────────────────────────────────────
const outDir = path.join(__dirname, '..', 'public', 'icons')
fs.mkdirSync(outDir, { recursive: true })

for (const size of [192, 512]) {
  const buf = createPNG(size)
  fs.writeFileSync(path.join(outDir, `icon-${size}-v2.png`), buf)
  console.log(`icon-${size}-v2.png  ${buf.length} bytes`)
}
