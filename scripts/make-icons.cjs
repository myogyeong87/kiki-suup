// Pure Node.js PNG generator (no dependencies)
// Creates mint/sage gradient icons with rounded corners (RGBA)
const fs   = require('fs')
const path = require('path')
const zlib = require('zlib')

function createPNG(size) {
  // ── PNG helpers ───────────────────────────────────────────
  function crc32(buf) {
    const table = []
    for (let i = 0; i < 256; i++) {
      let c = i
      for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
      table[i] = c
    }
    let crc = 0xFFFFFFFF
    for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8)
    return (crc ^ 0xFFFFFFFF) >>> 0
  }

  function chunk(type, data) {
    const typeBytes = Buffer.from(type, 'ascii')
    const len       = Buffer.alloc(4); len.writeUInt32BE(data.length)
    const combined  = Buffer.concat([typeBytes, data])
    const crcBuf    = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(combined))
    return Buffer.concat([len, combined, crcBuf])
  }

  // ── IHDR: RGBA (colorType = 6) ────────────────────────────
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8]  = 8  // bit depth
  ihdr[9]  = 6  // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0

  // ── 색상 정의 ─────────────────────────────────────────────
  // 그라디언트: top #2d8880 → bottom #6bbebc
  const top    = { r: 0x2d, g: 0x88, b: 0x80 }  // mint-600
  const bottom = { r: 0x6b, g: 0xbe, b: 0xbc }  // mint-300
  const radius = Math.round(size * 0.22)          // 모서리 반지름

  // ── 픽셀 데이터 생성 ──────────────────────────────────────
  // 각 행: filter(1) + RGBA×size
  const rowSize = 1 + size * 4
  const raw     = Buffer.alloc(size * rowSize)

  for (let y = 0; y < size; y++) {
    const off = y * rowSize
    raw[off] = 0 // no filter

    // 그라디언트 비율 (0=top, 1=bottom)
    const t = y / (size - 1)
    const gr = Math.round(top.r + (bottom.r - top.r) * t)
    const gg = Math.round(top.g + (bottom.g - top.g) * t)
    const gb = Math.round(top.b + (bottom.b - top.b) * t)

    for (let x = 0; x < size; x++) {
      const px = off + 1 + x * 4

      // 둥근 모서리: 코너 영역은 투명
      const cx = Math.min(x, size - 1 - x)
      const cy = Math.min(y, size - 1 - y)
      let alpha = 255
      if (cx < radius && cy < radius) {
        const dx = radius - cx - 1
        const dy = radius - cy - 1
        alpha = (Math.sqrt(dx * dx + dy * dy) <= radius) ? 255 : 0
      }

      raw[px]     = gr
      raw[px + 1] = gg
      raw[px + 2] = gb
      raw[px + 3] = alpha
    }
  }

  const compressed = zlib.deflateSync(raw, { level: 9 })
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0))
  ])
}

const outDir = path.join(__dirname, '..', 'public', 'icons')
fs.mkdirSync(outDir, { recursive: true })

for (const size of [192, 512]) {
  const buf = createPNG(size)
  fs.writeFileSync(path.join(outDir, `icon-${size}.png`), buf)
  console.log(`icon-${size}.png created (${size}×${size}, mint gradient)`)
}
