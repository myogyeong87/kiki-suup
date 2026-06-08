// Pure Node.js PNG generator (no dependencies)
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

function createPNG(size, r, g, b) {
  function crc32(buf) {
    let crc = 0xFFFFFFFF
    const table = []
    for (let i = 0; i < 256; i++) {
      let c = i
      for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
      table[i] = c
    }
    for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8)
    return (crc ^ 0xFFFFFFFF) >>> 0
  }

  function chunk(type, data) {
    const typeBytes = Buffer.from(type, 'ascii')
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
    const combined = Buffer.concat([typeBytes, data])
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(combined))
    return Buffer.concat([len, combined, crc])
  }

  // IHDR
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8   // bit depth
  ihdr[9] = 2   // RGB
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0

  // Raw image data: each row = filter byte (0) + RGB pixels
  const rowSize = 1 + size * 3
  const raw = Buffer.alloc(size * rowSize)
  for (let y = 0; y < size; y++) {
    const off = y * rowSize
    raw[off] = 0 // filter none
    for (let x = 0; x < size; x++) {
      raw[off + 1 + x * 3 + 0] = r
      raw[off + 1 + x * 3 + 1] = g
      raw[off + 1 + x * 3 + 2] = b
    }
  }

  const compressed = zlib.deflateSync(raw)
  const sig = Buffer.from([137,80,78,71,13,10,26,10])
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))])
}

const outDir = path.join(__dirname, '..', 'public', 'icons')
fs.mkdirSync(outDir, { recursive: true })

for (const size of [192, 512]) {
  const buf = createPNG(size, 124, 58, 237) // #7c3aed purple
  fs.writeFileSync(path.join(outDir, `icon-${size}.png`), buf)
  console.log(`icon-${size}.png created`)
}
