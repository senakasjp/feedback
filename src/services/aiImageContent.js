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

  if (['image/emf', 'image/x-emf', 'application/x-emf'].includes(declaredType) || bytes.slice(40, 44) === ' EMF') {
    try {
      const buffer = Uint8Array.from(bytes, character => character.charCodeAt(0)).buffer
      validateEmfRecords(buffer)
      const { convertMetafileToDataUrl } = await import('emf-converter')
      const data = await convertMetafileToDataUrl(buffer, { maxWidth: 1600, maxHeight: 1600, maxCanvasDimension: 1600 })
      if (!data?.startsWith('data:image/png;base64,')) throw new Error('EMF conversion failed')
      return { ...part, mimeType: 'image/png', data }
    } catch {
      throw new Error(`An embedded image (${declaredType}) could not be converted. Export the document as PDF or replace the image with PNG or JPEG and upload it again. No AI request was sent.`)
    }
  }

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

function validateEmfRecords(buffer) {
  const view = new DataView(buffer)
  if (buffer.byteLength < 88 || view.getUint32(0, true) !== 1 || view.getUint32(4, true) < 88 || view.getUint32(40, true) !== 0x464d4520 || view.getUint32(48, true) !== buffer.byteLength) {
    throw new Error('Invalid EMF header')
  }
  let offset = 0
  let records = 0
  while (offset + 8 <= buffer.byteLength) {
    const type = view.getUint32(offset, true)
    const size = view.getUint32(offset + 4, true)
    if (size < 8 || size % 4 !== 0 || offset + size > buffer.byteLength || ++records > 200000) {
      throw new Error('Invalid EMF record')
    }
    offset += size
    if (type === 14 && size >= 20 && offset === buffer.byteLength && records === view.getUint32(52, true)) return
  }
  throw new Error('Incomplete EMF data')
}
