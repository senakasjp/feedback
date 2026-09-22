import JSZip from 'jszip'

const drawingNs = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const relationshipNs = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const elements = (node, name) => Array.from(node.getElementsByTagNameNS('*', name))

function resolvePart(source, target) {
  return new URL(target, 'https://pptx.invalid/' + source).pathname.slice(1)
}

async function readXml(zip, path) {
  const entry = zip.file(path)
  if (!entry) throw new Error('PPTX is missing required content: ' + path)
  const xml = new DOMParser().parseFromString(await entry.async('string'), 'application/xml')
  if (elements(xml, 'parsererror').length) throw new Error('Invalid PPTX XML: ' + path)
  return xml
}

async function relationships(zip, path) {
  const slash = path.lastIndexOf('/')
  const relPath = path.slice(0, slash + 1) + '_rels/' + path.slice(slash + 1) + '.rels'
  if (!zip.file(relPath)) return []
  const xml = await readXml(zip, relPath)
  return elements(xml, 'Relationship')
    .filter(rel => rel.getAttribute('TargetMode') !== 'External')
    .map(rel => ({
      id: rel.getAttribute('Id'),
      type: rel.getAttribute('Type')?.split('/').pop(),
      path: resolvePart(path, rel.getAttribute('Target'))
    }))
}

function textParagraphs(xml) {
  return Array.from(xml.getElementsByTagNameNS(drawingNs, 'p')).map(paragraph =>
    Array.from(paragraph.getElementsByTagNameNS(drawingNs, '*'))
      .map(node => node.localName === 't' ? node.textContent : node.localName === 'br' ? '\n' : '')
      .join('')
  ).filter(text => text.trim()).join('\n')
}

export async function extractTextFromPptx(buffer, prepareImage) {
  const zip = await JSZip.loadAsync(buffer)
  const presentation = await readXml(zip, 'ppt/presentation.xml')
  const rels = await relationships(zip, 'ppt/presentation.xml')
  const slideIds = elements(presentation, 'sldId')
  if (!slideIds.length) throw new Error('The PPTX contains no slides.')
  const sections = []
  const images = []
  const seenImages = new Set()
  for (const [index, slideId] of slideIds.entries()) {
    const id = slideId.getAttributeNS(relationshipNs, 'id')
    const slide = rels.find(rel => rel.id === id && rel.type === 'slide')
    if (!slide) throw new Error('PPTX slide relationship is missing.')
    const xml = await readXml(zip, slide.path)
    const slideRels = await relationships(zip, slide.path)
    const content = ['Slide ' + (index + 1) + ':', textParagraphs(xml)]
    for (const rel of slideRels) {
      if (rel.type === 'notesSlide') {
        const notes = await readXml(zip, rel.path)
        for (const shape of elements(notes, 'sp')) {
          if (elements(shape, 'ph').some(ph => ['sldNum', 'hdr', 'ftr', 'dt'].includes(ph.getAttribute('type')))) shape.remove()
        }
        const text = textParagraphs(notes)
        if (text) content.push('Speaker notes:\n' + text)
      }
      if (rel.type === 'chart' || rel.type === 'diagramData') {
        const data = await readXml(zip, rel.path)
        const text = rel.type === 'chart'
          ? elements(data, 'v').map(node => node.textContent).join('\n')
          : textParagraphs(data)
        if (text) content.push('Diagram/chart data:\n' + text)
      }
      if (rel.type !== 'image' || seenImages.has(rel.path)) continue
      seenImages.add(rel.path)
      const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp' }[rel.path.split('.').pop().toLowerCase()]
      if (!mime) {
        content.push('[An embedded image format could not be read: ' + rel.path.split('.').pop() + ']')
        continue
      }
      const entry = zip.file(rel.path)
      if (!entry) throw new Error('PPTX embedded image is missing.')
      const image = await prepareImage('data:' + mime + ';base64,' + await entry.async('base64'))
      images.push({ ...image, pageNumber: index + 1 })
    }
    sections.push(content.filter(Boolean).join('\n'))
  }
  return { text: sections.join('\n\n'), images }
}
