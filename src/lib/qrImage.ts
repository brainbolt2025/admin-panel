export const QR_LOGO_SRC = '/AppIcon512x.png'

export function qrImageUrl(data: string, size = 280): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&ecc=H&margin=1&data=${encodeURIComponent(data)}`
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load ${src}`))
    img.src = src
  })
}

async function composeQrPngBlob(data: string, size = 512): Promise<Blob> {
  const qr = await loadImage(qrImageUrl(data, size))
  const logo = await loadImage(QR_LOGO_SRC)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not available')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, size, size)
  ctx.drawImage(qr, 0, 0, size, size)

  const logoBox = Math.round(size * 0.22)
  const pad = Math.round(size * 0.018)
  const x = Math.round((size - logoBox) / 2)
  const y = Math.round((size - logoBox) / 2)
  const outer = logoBox + pad * 2
  const radius = Math.round(outer * 0.18)

  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.roundRect(x - pad, y - pad, outer, outer, radius)
  ctx.fill()

  ctx.save()
  ctx.beginPath()
  ctx.roundRect(x, y, logoBox, logoBox, Math.round(logoBox * 0.18))
  ctx.clip()
  ctx.drawImage(logo, x, y, logoBox, logoBox)
  ctx.restore()

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('QR compose failed'))), 'image/png')
  })
}

export async function downloadQrPng(data: string, filename: string) {
  const fallbackUrl = qrImageUrl(data, 512)
  try {
    const blob = await composeQrPngBlob(data, 512)
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = filename.endsWith('.png') ? filename : `${filename}.png`
    link.click()
    URL.revokeObjectURL(objectUrl)
  } catch {
    window.open(fallbackUrl, '_blank', 'noopener,noreferrer')
  }
}

export async function printQr(data: string, title = 'QR code') {
  const fallbackUrl = qrImageUrl(data, 512)
  const safeTitle = title.replace(/[<>&"]/g, '')
  const popup = window.open('', '_blank')
  if (!popup) return

  let src = fallbackUrl
  try {
    const blob = await composeQrPngBlob(data, 512)
    src = URL.createObjectURL(blob)
  } catch {
    // print the plain QR if compose fails (CORS)
  }

  popup.document.write(
    `<!DOCTYPE html><html><head><title>${safeTitle}</title></head>` +
      `<body style="margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif">` +
      `<p style="font-size:14px;color:#111">${safeTitle}</p>` +
      `<img src="${src}" alt="${safeTitle}" onload="window.print()" />` +
      `</body></html>`,
  )
  popup.document.close()
}
