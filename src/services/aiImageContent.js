export async function normalizeAiImage(part) {
  const raw = String(part.data || '')
  const match = /^data:([^;,]+);base64,([\s\S]+)$/i.exec(raw)
  const declaredType = String(match?.[1] || part.mimeType || 'unknown').toLowerCase()
  const base64 = (match?.[2] || raw).replace(/\s/g, '')
  let bytes
  try {
    bytes = atob(base64)
  } catch {
    throw new Error('An image attachment has invalid image data. Replace it with PNG or JPEG and upload the document again.')
  }
  let mimeType = ''
  if (bytes.startsWith('\x89PNG\r\n\x1a\n')) mimeType = 'image/png'
  else if (bytes.startsWith('\xff\xd8\xff')) mimeType = 'image/jpeg'
  else if (/^GIF8[79]a/.test(bytes)) mimeType = 'image/gif'
  else if (bytes.startsWith('RIFF') && bytes.slice(8, 12) === 'WEBP') mimeType = 'image/webp'
  if (mimeType) return { ...part, mimeType, data: `data:${mimeType};base64,${base64}` }

  // Rasterize browser-supported formats instead of merely changing their MIME label.
  if (['image/bmp', 'image/x-ms-bmp'].includes(declaredType)) {
    try {
      const image = new Image()
      image.src = `data:${declaredType};base64,${base64}`
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Image conversion unavailable')
      context.drawImage(image, 0, 0)
      return { ...part, mimeType: 'image/png', data: canvas.toDataURL('image/png') }
    } catch {
      throw new Error(`An embedded image (${declaredType}) could not be converted. Replace it with PNG or JPEG and upload the document again. No AI request was sent.`)
    }
  }
  throw new Error(`An embedded image uses an unsupported or unreadable format (${declaredType}). Replace it with PNG or JPEG and upload the document again. No AI request was sent.`)
}
