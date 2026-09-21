export function readDocxSource(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = () => reject(new Error('Could not read the original DOCX file.'))
    reader.readAsDataURL(file)
  })
}

export async function renderDocxSource(base64) {
  const { renderAsync } = await import('docx-preview')
  const bytes = Uint8Array.from(atob(base64), character => character.charCodeAt(0))
  const body = document.createElement('div')
  const styles = document.createElement('div')
  await renderAsync(bytes, body, styles, {
    useBase64URL: true,
    renderAltChunks: false,
    ignoreLastRenderedPageBreak: false,
    breakPages: true,
    renderHeaders: true,
    renderFooters: true,
    ignoreWidth: false,
    ignoreHeight: false,
    ignoreFonts: false
  })
  if (!body.querySelector('section.docx')) throw new Error('No document pages could be rendered from this file.')
  for (const container of [body, styles]) {
    for (const element of container.querySelectorAll('*')) {
      if (['SCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'FORM'].includes(element.tagName)) {
        element.remove()
        continue
      }
      for (const attribute of [...element.attributes]) {
        if (/^on/i.test(attribute.name) || ['href', 'xlink:href', 'srcdoc'].includes(attribute.name) || (attribute.name === 'src' && !/^data:image\//i.test(attribute.value))) {
          element.removeAttribute(attribute.name)
        }
      }
    }
  }
  const width = body.querySelector('section.docx').style.width
  const pageWidth = parseFloat(width) * (width.endsWith('pt') ? 4 / 3 : 1) || 816
  return { markup: styles.innerHTML + body.innerHTML, pageWidth }
}

export function docxFrameHtml(markup, scale = 1) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><style>
    html, body { margin: 0; background: #e5e7eb; }
    .docx-wrapper { zoom: ${scale}; padding: 16px !important; }
    section.docx { flex-shrink: 0; }
  </style></head><body>${markup}</body></html>`
}
