import { test, expect } from '@playwright/test'
import JSZip from 'jszip'

async function docx() {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
  zip.file('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
  zip.file('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:rPr><w:color w:val="C00000"/><w:sz w:val="40"/></w:rPr><w:t>Project findings</w:t></w:r></w:p><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Measured evidence</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Result</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>2 ms</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:p><w:r><w:br w:type="page"/><w:t>Second page</w:t></w:r></w:p><w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>')
  return zip.generateAsync({ type: 'nodebuffer' })
}

async function open(page) {
  await page.addInitScript(() => {
    if (window !== window.top) return
    if (localStorage.getItem('docx-seeded')) return
    localStorage.clear()
    localStorage.setItem('feedback-subjects', JSON.stringify({ subjects: [{ id: 's', name: 'Viewer QA', assessments: [{ id: 'a', name: 'Documents assessment', categories: [], topics: [], knowledgeAreas: [], aiReferenceDocuments: [] }] }], students: [{ id: 'one', name: 'First Student', displayName: 'First Student' }, { id: 'two', name: 'Second Student', displayName: 'Second Student' }] }))
    localStorage.setItem('student-evaluation-one-a', JSON.stringify({ studentId: 'one', assessmentId: 'a', studentName: 'First Student', categoryMarks: { Safety: 7 }, studentSubmissionDocuments: [{ id: 'old', name: 'Old.docx', extractedText: 'Legacy text' }, { id: 'saved', name: 'Student.docx', docxHtml: '<h1>Student only content</h1><script>window.parent.hacked=true</script><img src="https://example.com/tracker"><a href="https://example.com">Link</a>', extractedText: 'Student only content' }] }))
    localStorage.setItem('feedback-navigation-state-v1', JSON.stringify({ view: 'subjects' }))
    localStorage.setItem('docx-seeded', 'true')
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Open subject Viewer QA', exact: true }).click()
  await page.getByRole('button', { name: /Open Feedback/ }).click()
}

test('uploads and displays formatted DOCX and persists its preview', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await open(page)
  const tab = page.locator('.feedback-tab-bar').getByRole('button', { name: 'DOCX Viewer', exact: true })
  await tab.click()
  await expect(page.getByText('No uploaded DOCX documents yet.', { exact: false })).toBeVisible()
  await page.locator('.feedback-tab-bar').getByRole('button', { name: /Settings/ }).click()
  await page.locator('#assessmentDocumentUpload').setInputFiles({ name: 'Report.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: await docx() })
  await expect(page.getByText('Report.docx', { exact: true })).toBeVisible()
  await tab.click()
  const preview = page.frameLocator('iframe[title="DOCX preview: Report.docx"]')
  await expect(preview.getByText('Project findings', { exact: true })).toBeVisible()
  await expect(preview.getByText('Measured evidence', { exact: true })).toHaveCSS('font-weight', '700')
  await expect(preview.getByText('Project findings', { exact: true })).toHaveCSS('color', 'rgb(192, 0, 0)')
  await expect(preview.locator('section.docx')).toHaveCount(2)
  await expect(preview.locator('section.docx').first()).toHaveCSS('padding-left', '96px')
  await expect(preview.getByRole('cell', { name: '2 ms' })).toBeVisible()
  const closeNotice = page.getByRole('button', { name: 'Close notification', exact: true })
  if (await closeNotice.isVisible()) await closeNotice.click()
  for (const theme of ['light', 'dark']) {
    const toggle = page.getByRole('button', { name: `Switch to ${theme === 'dark' ? 'Dark' : 'Light'} Mode`, exact: true })
    if (await toggle.isVisible()) await toggle.click()
    for (const width of [375, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 })
      await page.locator('.document-viewer').scrollIntoViewIfNeeded()
      expect(await page.locator('.document-viewer').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
      await page.locator('.document-viewer').screenshot({ path: `/tmp/docx-viewer-${theme}-${width}.png` })
    }
  }
  await page.evaluate(() => localStorage.setItem('feedback-navigation-state-v1', JSON.stringify({ view: 'subjects' })))
  await open(page)
  await page.locator('.feedback-tab-bar').getByRole('button', { name: 'DOCX Viewer', exact: true }).click()
  await expect(preview.getByRole('cell', { name: '2 ms' })).toBeVisible()
  expect(errors).toEqual([])
})

test('attaches original DOCX to older student uploads and persists it without changing marks', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'Student:', exact: true }).click()
  await page.getByRole('button', { name: /First Student/ }).click()
  await page.locator('.feedback-tab-bar').getByRole('button', { name: 'DOCX Viewer', exact: true }).click()
  await expect(page.getByText(/original Word file was not retained/)).toBeVisible()
  await expect(page.getByText('Previously extracted text')).toHaveCount(0)
  await page.getByLabel('Attach original DOCX').setInputFiles({ name: 'Old.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: await docx() })
  const frame = page.frameLocator('iframe')
  await expect(frame.getByText('Project findings', { exact: true })).toBeVisible()
  await expect(frame.locator('section.docx')).toHaveCount(2)
  await expect(page.locator('iframe')).toHaveAttribute('sandbox', '')
  await expect.poll(() => page.evaluate(() => Boolean(JSON.parse(localStorage.getItem('student-evaluation-one-a')).studentSubmissionDocuments[0].docxBase64))).toBe(true)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('student-evaluation-one-a')).categoryMarks)).toEqual({ Safety: 7 })
  await page.getByLabel('Zoom', { exact: true }).selectOption('1.5')
  await expect(frame.locator('.docx-wrapper')).toHaveCSS('zoom', '1.5')
  await page.locator('.feedback-tab-bar').getByRole('button', { name: /Enter Data/ }).click()
  await page.getByRole('button', { name: 'Student:', exact: true }).click()
  await page.getByRole('button', { name: /Second Student/ }).click()
  await page.locator('.feedback-tab-bar').getByRole('button', { name: 'DOCX Viewer', exact: true }).click()
  await expect(page.locator('iframe')).toHaveCount(0)
  await expect(page.getByText(/No uploaded DOCX documents yet/)).toBeVisible()
  await page.locator('.feedback-tab-bar').getByRole('button', { name: /Enter Data/ }).click()
  await page.getByRole('button', { name: 'Student:', exact: true }).click()
  await page.getByRole('button', { name: /First Student/ }).click()
  await page.locator('.feedback-tab-bar').getByRole('button', { name: 'DOCX Viewer', exact: true }).click()
  await expect(frame.getByText('Project findings', { exact: true })).toBeVisible()
})

test('rejects invalid originals without saving them', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'Student:', exact: true }).click()
  await page.getByRole('button', { name: /First Student/ }).click()
  await page.locator('.feedback-tab-bar').getByRole('button', { name: 'DOCX Viewer', exact: true }).click()
  await page.getByLabel('Attach original DOCX').setInputFiles({ name: 'Old.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from('invalid file') })
  await expect(page.locator('.document-viewer [role="alert"]')).toBeVisible()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('student-evaluation-one-a')).studentSubmissionDocuments[0].docxBase64)).toBeUndefined()
  await expect(page.locator('iframe')).toHaveCount(0)
})

test('Navigation buttons restore the last marks position', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 650 })
  await open(page)
  const switcher = page.getByRole('navigation', { name: 'Switch between marks and document' })
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }))
  const position = await page.evaluate(() => window.scrollY)
  expect(position).toBeGreaterThan(100)
  await expect(switcher).toBeInViewport()
  await switcher.getByRole('button', { name: 'DOCX Viewer', exact: true }).click()
  await expect(page.getByRole('region', { name: 'DOCX viewer', exact: true })).toBeVisible()
  await switcher.getByRole('button', { name: 'Marks', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeCloseTo(position, 0)
  await expect(switcher.getByRole('button', { name: 'Marks', exact: true })).toHaveAttribute('aria-pressed', 'true')
  for (const theme of ['light', 'dark']) {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
    const toggle = page.getByRole('button', { name: `Switch to ${theme === 'dark' ? 'Dark' : 'Light'} Mode`, exact: true })
    if (await toggle.isVisible()) await toggle.click()
    for (const width of [375, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 })
      const showNavigation = page.getByRole('button', { name: /Show Navigation/ })
      if (await showNavigation.isVisible()) await showNavigation.click()
      await switcher.scrollIntoViewIfNeeded()
      await expect(switcher).toBeVisible()
      expect(await switcher.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
      await page.locator('.app-sidebar-column').screenshot({ path: `/tmp/feedback-switch-${theme}-${width}.png` })
    }
  }
})

test('new student upload retains original DOCX and complete extracted text', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'Student:', exact: true }).click()
  await page.getByRole('button', { name: /Second Student/ }).click()
  await page.locator('#studentDocumentUpload').setInputFiles({ name: 'New.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: await docx() })
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('student-evaluation-two-a') || '{}').studentSubmissionDocuments?.[0]?.extractedText)).toContain('Second page')
  await page.locator('.feedback-tab-bar').getByRole('button', { name: 'DOCX Viewer', exact: true }).click()
  await expect(page.frameLocator('iframe').locator('section.docx')).toHaveCount(2)
})
