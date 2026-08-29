const TEXT_FILE_EXTENSIONS = new Set(['txt', 'md', 'csv', 'json', 'html', 'htm', 'xml'])

function normaliseWhitespace(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function stripHtml(html) {
  const container = document.createElement('div')
  container.innerHTML = String(html || '')
  return normaliseWhitespace(container.textContent || container.innerText || '')
}

function getFileExtension(fileName = '') {
  const parts = String(fileName).split('.')
  return parts.length > 1 ? parts.pop().toLowerCase() : ''
}

async function readFileAsArrayBuffer(file) {
  if (file && typeof file.arrayBuffer === 'function') {
    return file.arrayBuffer()
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error || new Error('Failed to read file as ArrayBuffer'))
    reader.readAsArrayBuffer(file)
  })
}

async function readFileAsText(file) {
  if (file && typeof file.text === 'function') {
    return file.text()
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('Failed to read file as text'))
    reader.readAsText(file)
  })
}

function reconstructLinesFromTextItems(items) {
  const lines = []
  let currentLine = []
  let lastY = null

  for (const item of items) {
    if (!('str' in item)) continue
    const y = Array.isArray(item.transform) ? item.transform[5] : null
    if (lastY !== null && y !== null && Math.abs(y - lastY) > 1) {
      lines.push(currentLine.join(' ').replace(/\s+/g, ' ').trim())
      currentLine = []
    }
    if (item.str) currentLine.push(item.str)
    if (y !== null) lastY = y
  }
  if (currentLine.length) lines.push(currentLine.join(' ').replace(/\s+/g, ' ').trim())

  return lines.filter(Boolean).join('\n')
}

// Renders every PDF page to a PNG so a vision model can see diagrams/charts that are drawn
// directly on the page (not just embedded raster images, which pdfjs makes much harder to isolate).
// ponytail: no downscaling/limiting - caller asked to prioritise robustness over token cost.
async function renderPdfPagesAsImages(pdf, pdfjsLib) {
  const images = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const viewport = page.getViewport({ scale: 2 })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const context = canvas.getContext('2d')
    await page.render({ canvasContext: context, viewport }).promise
    images.push({ mimeType: 'image/png', dataUrl: canvas.toDataURL('image/png'), pageNumber })
  }

  return images
}

async function extractTextFromPdf(file) {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const buffer = await readFileAsArrayBuffer(file)
  let pdf

  try {
    // Preferred path with worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.mjs', import.meta.url).toString()
    pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  } catch {
    // Tauri/WebView fallback: disable worker when worker boot fails
    pdf = await pdfjsLib.getDocument(/** @type {any} */ ({ data: buffer, disableWorker: true })).promise
  }
  const pages = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    const text = reconstructLinesFromTextItems(content.items)

    if (text) {
      pages.push(`Page ${pageNumber}:\n${text}`)
    }
  }

  // Text extraction already captures printed text cleanly - OCR would only duplicate it, so
  // page renders here are for vision (diagrams/charts), not OCR.
  const images = await renderPdfPagesAsImages(pdf, pdfjsLib)

  return { text: normaliseWhitespace(pages.join('\n\n')), images }
}

async function ocrImage(dataUrl) {
  try {
    const { default: Tesseract } = await import('tesseract.js')
    const { data } = await Tesseract.recognize(dataUrl, 'eng')
    return normaliseWhitespace(data?.text || '')
  } catch {
    return ''
  }
}

async function extractImagesFromDocx(file, mammoth) {
  const images = []
  const arrayBuffer = await readFileAsArrayBuffer(file)

  await mammoth.convertToHtml({ arrayBuffer }, {
    convertImage: mammoth.images.imgElement(async image => {
      const base64 = await image.read('base64')
      const mimeType = image.contentType || 'image/png'
      images.push({ mimeType, dataUrl: `data:${mimeType};base64,${base64}` })
      return {}
    })
  })

  for (const image of images) {
    image.ocrText = await ocrImage(image.dataUrl)
  }

  return images
}

async function extractTextFromDocx(file) {
	const mammothModule = await import('mammoth')
	const mammoth = mammothModule.default || mammothModule
	const arrayBuffer = await readFileAsArrayBuffer(file)
	const result = await mammoth.extractRawText({ arrayBuffer })
	const images = await extractImagesFromDocx(file, mammoth)
	return { text: normaliseWhitespace(result.value), images }
}

async function extractTextFromTextFile(file, extension) {
  const rawText = await readFileAsText(file)
  const text = (extension === 'html' || extension === 'htm' || file.type === 'text/html')
    ? stripHtml(rawText)
    : normaliseWhitespace(rawText)
  return { text, images: [] }
}

/** @returns {Promise<{ text: string, images: Array<{ mimeType: string, dataUrl: string, ocrText?: string, pageNumber?: number }> }>} */
export async function extractTextFromFile(file) {
  const extension = getFileExtension(file?.name)

  if (extension === 'pdf' || file?.type === 'application/pdf') {
    return extractTextFromPdf(file)
  }

  if (extension === 'docx' || file?.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return extractTextFromDocx(file)
  }

  if (TEXT_FILE_EXTENSIONS.has(extension) || String(file?.type || '').startsWith('text/')) {
    return extractTextFromTextFile(file, extension)
  }

  throw new Error(`Unsupported file type for ${file?.name || 'upload'}. Use PDF, DOCX, TXT, MD, HTML, CSV, or JSON.`)
}

export function createUploadedDocumentRecord({ file, extractedText, images = [], documentType, scope = 'assessment' }) {
  return {
    id: `${scope}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size || 0,
    documentType,
    extractedText: normaliseWhitespace(extractedText),
    images: Array.isArray(images) ? images : [],
    uploadedAt: new Date().toISOString()
  }
}

export function getSupportedUploadLabel() {
  return 'PDF, DOCX, TXT, MD, HTML, CSV, JSON'
}
