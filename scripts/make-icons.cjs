// SVG → PNG icon generator using @resvg/resvg-js
// Pink background (#f7cfe0) + broom-witch SVG centered with padding
const { Resvg } = require('@resvg/resvg-js')
const fs   = require('fs')
const path = require('path')

const svgPath = path.join(__dirname, '..', 'public', 'broom-witch-svgrepo-com.svg')
const outDir  = path.join(__dirname, '..', 'public', 'icons')
fs.mkdirSync(outDir, { recursive: true })

// Read SVG, swap purple background → light pink
let svg = fs.readFileSync(svgPath, 'utf-8')
svg = svg.replace('fill:#954E9D;', 'fill:#f7cfe0;')

// Add ~12% padding by expanding the viewBox
// Original viewBox: 0 0 473.931 473.931 → expand by ±56 on each side
const pad = 56
svg = svg.replace(
  'viewBox="0 0 473.931 473.931"',
  `viewBox="${-pad} ${-pad} ${473.931 + pad * 2} ${473.931 + pad * 2}"`
)

for (const size of [192, 512]) {
  const resvg = new Resvg(svg, {
    background: '#f7cfe0',
    fitTo: { mode: 'width', value: size }
  })
  const png = resvg.render().asPng()
  const file = path.join(outDir, `icon-${size}-v3.png`)
  fs.writeFileSync(file, png)
  console.log(`icon-${size}-v3.png  ${png.length} bytes`)
}
