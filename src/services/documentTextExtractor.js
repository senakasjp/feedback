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

async function extractTextFromPdf(file) {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.mjs', import.meta.url).toString()
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  const pages = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    const text = content.items
      .map(item => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()

    if (text) {
      pages.push(`Page ${pageNumber}: ${text}`)
    }
  }

  return normaliseWhitespace(pages.join('\n\n'))
}

async function extractTextFromDocx(file) {
	const mammothModule = await import('mammoth')
	const mammoth = mammothModule.default || mammothModule
	const arrayBuffer = await file.arrayBuffer()
	const result = await mammoth.extractRawText({ arrayBuffer })
	return normaliseWhitespace(result.value)
}

async function extractTextFromTextFile(file, extension) {
  const rawText = await file.text()
  if (extension === 'html' || extension === 'htm' || file.type === 'text/html') {
    return stripHtml(rawText)
  }

  return normaliseWhitespace(rawText)
}

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

export function createUploadedDocumentRecord({ file, extractedText, documentType, scope = 'assessment' }) {
  return {
    id: `${scope}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size || 0,
    documentType,
    extractedText: normaliseWhitespace(extractedText),
    uploadedAt: new Date().toISOString()
  }
}

export function getSupportedUploadLabel() {
  return 'PDF, DOCX, TXT, MD, HTML, CSV, JSON'
}
