// The carton fronts are printed at the same resolution as the shop sign and the plinth label.
export function drawPackage(ctx: CanvasRenderingContext2D, sku: string) {
  const record = sku.endsWith('-CD')
  const character = sku === 'SONIC' || sku === 'FOREST' || sku.startsWith('KITTY')
  const ink = sku === 'ROBOT' || sku.startsWith('KISS-B') ? '#b43e30'
    : sku === 'FOREST' || sku.startsWith('KIBOU') ? '#416e67' : '#3c5878'
  ctx.fillStyle = '#e9e5d8'
  ctx.fillRect(0, 0, 640, 340)
  ctx.fillStyle = ink
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(370, 0)
  ctx.lineTo(256, 260)
  ctx.lineTo(0, 260)
  ctx.fill()
  ctx.save()
  ctx.translate(66, 23)
  ctx.lineJoin = 'round'
  ctx.strokeStyle = '#263541'
  ctx.fillStyle = '#fbf5e9'
  ctx.lineWidth = 9
  if (sku === 'ROBOT') {
    const shell = new Path2D('M 22 178 L 49 105 L 29 36 L 58 48 L 92 87 L 160 64 L 209 76 L 226 11 L 243 8 L 241 106 L 250 135 L 229 192 L 139 222 L 79 199 Z')
    ctx.fill(shell)
    ctx.stroke(shell)
    ctx.fillStyle = '#334c62'
    ctx.fill(new Path2D('M 57 145 L 112 153 L 221 113 L 215 147 L 119 182 L 65 168 Z'))
    ctx.fillStyle = ink
    ctx.fill(new Path2D('M 124 187 L 149 176 L 157 201 L 134 211 Z'))
  } else if (character) {
    const head = new Path2D('M 34 136 Q 19 84 48 66 L 28 7 Q 69 -2 99 60 Q 141 40 184 64 Q 215 10 245 16 L 221 90 Q 252 144 219 182 Q 202 211 139 214 Q 60 224 34 161 Z')
    ctx.fill(head)
    ctx.stroke(head)
    ctx.fillStyle = '#263541'
    for (const x of [96, 173]) {
      ctx.beginPath()
      ctx.ellipse(x, 135, 7, 13, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fill(new Path2D('M 124 158 L 148 158 L 140 171 Z'))
  } else if (record) {
    ctx.beginPath()
    ctx.ellipse(133, 117, 102, 98, -.15, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.lineWidth = 4
    for (const r of [32, 65, 80]) {
      ctx.beginPath()
      ctx.arc(133, 117, r, .52, 4.5)
      ctx.stroke()
    }
    ctx.fillStyle = ink
    ctx.beginPath()
    ctx.arc(133, 117, 19, 0, Math.PI * 2)
    ctx.fill()
  } else if (sku === 'RARE-CAR') {
    const car = new Path2D('M 8 132 L 77 105 L 118 69 L 184 63 L 219 98 L 251 117 L 245 158 L 27 174 Z')
    ctx.fill(car)
    ctx.stroke(car)
    ctx.fillStyle = '#263541'
    ctx.fill(new Path2D('M 94 103 L 125 77 L 176 73 L 199 99 Z'))
    for (const x of [65, 202]) {
      ctx.beginPath()
      ctx.arc(x, 157, 23, 0, Math.PI * 2)
      ctx.fill()
    }
  } else {
    const cover = new Path2D('M 57 47 L 177 23 L 214 183 L 93 212 Z')
    ctx.fill(cover)
    ctx.stroke(cover)
    ctx.fillStyle = ink
    ctx.fill(new Path2D('M 81 69 L 159 54 L 175 129 L 98 145 Z'))
  }
  ctx.restore()
  ctx.fillStyle = '#263541'
  ctx.fillRect(0, 257, 640, 83)
  ctx.fillStyle = '#f8f5eb'
  ctx.font = 'bold 55px monospace'
  ctx.textBaseline = 'middle'
  ctx.fillText(sku, 25, 303, 520)
  ctx.fillStyle = ink
  ctx.beginPath()
  ctx.arc(463, 114, 45, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#263541'
  ctx.fillRect(400, 196, 117, 7)
  ctx.fillRect(400, 212, 77, 5)
}
