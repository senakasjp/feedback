import { test, expect } from '@playwright/test'

const firstLabel = '1.1 Problem relevance and context definition (LO1)'
const firstCategory = 'Problem relevance and context definition'

async function openMatching(page, empty = false) {
  await page.addInitScript(({ empty, firstLabel, firstCategory }) => {
    if (localStorage.getItem('rubric-matching-seeded')) return
    const categories = empty ? [] : [firstCategory, 'AI tool selection and justification', 'Evaluation (LO1)', 'Evaluation (LO2)'].map((name, index) => ({ id: `c${index}`, name, allocatedMarks: 10, markingMode: 'percentage' }))
    const rubricHtml = `<table><tr><td>Criterion / Sub-criterion (LO Link)</td><td>Excellent</td><td>Needs improvement</td><td>Marks</td></tr><tr><th>${firstLabel}</th><td>Relevant problem supported by evidence.</td><td>No relevant problem identified.</td><td></td></tr><tr><td>2.1 AI tool selection and justification (LO1, LO3)</td><td>Appropriate tools justified.</td><td>No tool justification.</td><td></td></tr><tr><td>Evaluation</td><td>Critical discussion.</td><td>Discussion missing.</td><td></td></tr><tr><td>Unrelated criterion</td><td>Complete.</td><td>Missing.</td><td></td></tr></table>`
    const assessments = ['a', 'b'].map(id => ({ id, name: `Rubric ${id}`, totalMarks: empty ? 0 : 40, categories, topics: [], knowledgeAreas: [], markingMode: 'percentage', rubricHtml, tableColumnMarkMap: { 1: 1, 5: 2 } }))
    localStorage.setItem('feedback-subjects', JSON.stringify({ subjects: [{ id: 's', name: 'Rubric QA', assessments }], students: [{ id: 'student', name: 'Rubric Test Student', displayName: 'Rubric Test Student' }], percentageRanges: [] }))
    for (const id of ['a', 'b']) localStorage.setItem(`feedback-assessment-s-${id}`, JSON.stringify({ paragraphs: [], selectedParagraphs: [], categoryMarks: {}, rubricHtml }))
    localStorage.setItem('feedback-navigation-state-v1', JSON.stringify({ view: 'subjects' }))
    localStorage.setItem('rubric-matching-seeded', 'true')
  }, { empty, firstLabel, firstCategory })
  await page.goto('/')
  await page.getByRole('button', { name: 'Open subject Rubric QA', exact: true }).click()
  await page.getByRole('button', { name: /Open Feedback/ }).first().click()
  await page.locator('.feedback-tab-bar').getByRole('button', { name: /Settings/ }).click()
  const show = page.getByRole('button', { name: 'Show HTML input', exact: true })
  if (await show.isVisible()) await show.click()
}

const rowSelect = (page, label) => page.getByRole('combobox', { name: `Category for ${label}`, exact: true })

test('shows automatic category matches, excludes headers and preserves manual overrides', async ({ page }) => {
  await openMatching(page)
  await expect(rowSelect(page, firstLabel).locator('option:checked')).toHaveText(`Auto: ${firstCategory}`)
  await expect(page.getByText('4 rows detected', { exact: true })).toBeVisible()
  await expect(rowSelect(page, 'Criterion / Sub-criterion (LO Link)')).toHaveCount(0)
  await expect(rowSelect(page, '2.1 AI tool selection and justification (LO1, LO3)').locator('option:checked')).toHaveText('Auto: AI tool selection and justification')
  await expect(rowSelect(page, 'Evaluation').locator('option:checked')).toHaveText('No automatic match — choose a category')
  await expect(rowSelect(page, 'Unrelated criterion').locator('option:checked')).toHaveText('No automatic match — choose a category')
  await rowSelect(page, firstLabel).selectOption('AI tool selection and justification')
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('feedback-assessment-s-a')).tableRowCategoryMap)).toEqual({ '1.1 problem relevance and context definition': 'AI tool selection and justification' })
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('feedback-assessment-s-b')).tableRowCategoryMap || {})).toEqual({})
  await page.reload()
  await page.getByRole('button', { name: 'Open subject Rubric QA', exact: true }).click()
  await page.getByRole('button', { name: /Open Feedback/ }).first().click()
  await page.locator('.feedback-tab-bar').getByRole('button', { name: /Settings/ }).click()
  const show = page.getByRole('button', { name: 'Show HTML input', exact: true })
  if (await show.isVisible()) await show.click()
  await expect(rowSelect(page, firstLabel)).toHaveValue('AI tool selection and justification')
  await rowSelect(page, firstLabel).selectOption('')
  await expect(rowSelect(page, firstLabel).locator('option:checked')).toHaveText(`Auto: ${firstCategory}`)
  const notificationClose = page.getByRole('button', { name: 'Close notification', exact: true })
  if (await notificationClose.isVisible()) await notificationClose.click()
  const section = page.getByText('Match table rows to categories', { exact: true }).locator('../..')
  for (const theme of ['light', 'dark']) {
    if (theme === 'dark') await page.getByRole('button', { name: 'Switch to Dark Mode', exact: true }).click()
    for (const width of [375, 768, 1280]) {
      await page.setViewportSize({ width, height: 1000 })
      await section.evaluate(element => element.scrollIntoView({ block: 'center' }))
      await section.screenshot({ path: `/tmp/rubric-matching-${theme}-${width}.png` })
    }
  }
})

test('offers category creation when the assessment has no categories to match', async ({ page }) => {
  await openMatching(page, true)
  await expect(page.getByRole('button', { name: 'Create categories from rubric', exact: true })).toBeVisible()
  await expect(rowSelect(page, firstLabel)).toBeEnabled()
  await rowSelect(page, firstLabel).selectOption({ label: 'Create category from this row' })
  await expect(rowSelect(page, firstLabel).locator('option:checked')).toHaveText(`Auto: ${firstLabel}`)
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('feedback-subjects')).subjects[0].assessments[0].categories.map(category => category.name))).toEqual([firstLabel])
})

async function captureReport(page) {
  await page.evaluate(() => {
    window.rubricReportRows = []
    const observer = new MutationObserver(() => {
      const table = document.querySelector('.pdf-assessment-html table')
      if (!table) return
      window.rubricReportRows = [...table.rows].map(row => [...row.cells].map(cell => ({ text: cell.textContent, highlighted: cell.hasAttribute('data-color') })))
      observer.disconnect()
    })
    observer.observe(document.body, { childList: true })
  })
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: /Print to Download/ }).click()
  const download = await downloaded
  expect(await download.failure()).toBeNull()
  await download.saveAs('/tmp/rubric-matching-report.pdf')
  return page.evaluate(() => window.rubricReportRows)
}

test('uses resolved categories for rubric templates, PDF marks and distinct learning outcomes', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await openMatching(page)
  const input = page.locator('#assessmentHtmlInput')
  await input.fill((await input.inputValue()).replace('</table>', '<tr><td>Evaluation (LO1)</td><td>Strong evaluation of LO1.</td><td>Missing evaluation of LO1.</td><td></td></tr><tr><td>Evaluation (LO2)</td><td>Strong evaluation of LO2.</td><td>Missing evaluation of LO2.</td><td></td></tr></table>'))
  await page.locator('.feedback-tab-bar').getByRole('button', { name: /Enter Data/ }).click()
  await page.getByRole('button', { name: /Fill All Category Color Bands/ }).click()
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('feedback-assessment-s-a')).paragraphs.length)).toBe(8)
  await page.evaluate(() => {
    const key = 'feedback-assessment-s-a'
    const data = JSON.parse(localStorage.getItem(key))
    data.paragraphs.forEach(paragraph => { delete paragraph.rubricBandPosition })
    localStorage.setItem(key, JSON.stringify(data))
  })
  await page.reload()
  await page.getByRole('button', { name: 'Open subject Rubric QA', exact: true }).click()
  await page.getByRole('button', { name: /Open Feedback/ }).first().click()
  await page.getByRole('button', { name: 'Student:', exact: true }).click()
  await page.getByRole('button', { name: /Rubric Test Student/ }).click()
  await expect(page.locator('.paragraph-item').filter({ hasText: 'Relevant problem supported by evidence.' })).toHaveCount(1)
  await expect(page.locator('.paragraph-item').filter({ hasText: 'Appropriate tools justified.' })).toHaveCount(1)
  for (const [name, text, marks] of [[firstCategory, 'Relevant problem supported by evidence.', 8], ['Evaluation (LO1)', 'Missing evaluation of LO1.', 1], ['Evaluation (LO2)', 'Strong evaluation of LO2.', 8]]) {
    await page.locator('.paragraph-item').filter({ hasText: text }).getByRole('checkbox').check()
    await page.getByRole('spinbutton', { name: `Marks for ${name}`, exact: true }).fill(String(marks))
    await page.getByRole('spinbutton', { name: `Marks for ${name}`, exact: true }).blur()
  }
  const rows = await captureReport(page)
  const first = rows.find(row => row[0].text === firstLabel)
  expect(first[3].text).toBe('8 / 10')
  expect(first[1].highlighted).toBe(true)
  const lo1 = rows.find(row => row[0].text === 'Evaluation (LO1)')
  const lo2 = rows.find(row => row[0].text === 'Evaluation (LO2)')
  expect(lo1[3].text).toBe('1 / 10')
  expect(lo1[2].highlighted).toBe(true)
  expect(lo1[1].highlighted).toBe(false)
  expect(lo2[3].text).toBe('8 / 10')
  expect(lo2[1].highlighted).toBe(true)
  expect(rows.find(row => row[0].text === 'Evaluation')[3].text).toBe('')
  expect(errors).toEqual([])
})

test('matches the first data row in a headerless rubric with a TH row label', async ({ page }) => {
  await openMatching(page)
  const input = page.locator('#assessmentHtmlInput')
  await input.fill((await input.inputValue()).replace('<tr><td>Criterion / Sub-criterion (LO Link)</td><td>Excellent</td><td>Needs improvement</td><td>Marks</td></tr>', ''))
  await input.fill((await input.inputValue()).replace('</table>', '<tr><td>Evaluation (LO1)</td><td>Strong evaluation of LO1.</td><td>Missing evaluation of LO1.</td><td></td></tr><tr><td>Evaluation (LO2)</td><td>Strong evaluation of LO2.</td><td>Missing evaluation of LO2.</td><td></td></tr></table>'))
  await expect(rowSelect(page, firstLabel).locator('option:checked')).toHaveText(`Auto: ${firstCategory}`)
  await page.locator('.feedback-tab-bar').getByRole('button', { name: /Enter Data/ }).click()
  await page.getByRole('button', { name: /Fill All Category Color Bands/ }).click()
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('feedback-assessment-s-a')).paragraphs.length)).toBe(8)
  await page.getByRole('button', { name: 'Student:', exact: true }).click()
  await page.getByRole('button', { name: /Rubric Test Student/ }).click()
  await page.locator('.paragraph-item').filter({ hasText: 'Relevant problem supported by evidence.' }).getByRole('checkbox').check()
  const rows = await captureReport(page)
  expect(rows[0][0].text).toBe(firstLabel)
  expect(rows[0][1].highlighted).toBe(true)
})

test('fills all five mapped colour bands, refreshes old placeholders and preserves written feedback', async ({ page }) => {
  await openMatching(page)
  const input = page.locator('#assessmentHtmlInput')
  const bands = ['green', 'lightgreen', 'yellow', 'orange', 'red']
  await input.fill(`<table><tr><th>Criterion</th>${bands.map(color => `<th>${color}</th>`).join('')}</tr><tr><td>${firstLabel}</td>${bands.map(color => `<td>${color} problem descriptor.</td>`).join('')}</tr><tr><td>Tools rubric alias</td>${bands.map(color => `<td>${color} tools descriptor.</td>`).join('')}</tr></table>`)
  await rowSelect(page, 'Tools rubric alias').selectOption('AI tool selection and justification')
  for (let i = 0; i < bands.length; i++) {
    await page.getByRole('combobox', { name: `Column for ${bands[i]} band`, exact: true }).selectOption(String(i + 1))
  }
  await page.getByRole('button', { name: /Save Assignment/ }).click()
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('feedback-assessment-s-a')).tableColumnMarkMap)).toEqual({ 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 })
  await page.evaluate(({ firstCategory, bands }) => {
    const key = 'feedback-assessment-s-a'
    const data = JSON.parse(localStorage.getItem(key))
    data.paragraphs = bands.map(color => ({ id: `existing-${color}`, text: `${firstCategory}: ${color === 'green' ? 'Keep my written feedback.' : '[add feedback for this band]'}`, color, _source: 'assignment' }))
    localStorage.setItem(key, JSON.stringify(data))
  }, { firstCategory, bands })
  await page.reload()
  await page.getByRole('button', { name: 'Open subject Rubric QA', exact: true }).click()
  await page.getByRole('button', { name: /Open Feedback/ }).first().click()
  await page.getByRole('button', { name: /Fill All Category Color Bands/ }).click()
  await expect(page.locator('.paragraph-item').filter({ hasText: 'lightgreen problem descriptor.' })).toHaveCount(1)
  for (const color of bands) {
    await expect(page.locator('.paragraph-item').filter({ has: page.getByText(`${color} tools descriptor.`, { exact: true }) })).toHaveCount(1)
  }
  await expect(page.locator('.paragraph-item').filter({ hasText: 'Keep my written feedback.' })).toHaveCount(1)
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('feedback-assessment-s-a')).paragraphs.find(p => p.id === 'existing-red').text)).toBe(`${firstCategory}: red problem descriptor.`)
  await page.getByRole('button', { name: /Fill All Category Color Bands/ }).click()
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('feedback-assessment-s-a')).paragraphs.length)).toBe(10)
  const notificationClose = page.getByRole('button', { name: 'Close notification', exact: true })
  if (await notificationClose.isVisible()) await notificationClose.click()
  const toolbar = page.getByRole('button', { name: /Fill All Category Color Bands/ }).locator('..')
  for (const theme of ['light', 'dark']) {
    if (theme === 'dark') await page.getByRole('button', { name: 'Switch to Dark Mode', exact: true }).click()
    for (const width of [375, 768, 1280]) {
      await page.setViewportSize({ width, height: 1000 })
      await toolbar.evaluate(element => element.scrollIntoView({ block: 'center' }))
      await toolbar.screenshot({ path: `/tmp/rubric-autofill-${theme}-${width}.png` })
    }
  }
})

test('creates categories from a pasted rubric, enables matching and persists only this assessment', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await openMatching(page, true)
  await captureCategoryCreation(page, 'empty')
  await page.getByRole('button', { name: 'Create categories from rubric', exact: true }).click()
  await expect(rowSelect(page, firstLabel)).toBeEnabled()
  await expect(rowSelect(page, firstLabel).locator('option:checked')).toHaveText(`Auto: ${firstLabel}`)
  const expectedNames = [firstLabel, '2.1 AI tool selection and justification (LO1, LO3)', 'Evaluation', 'Unrelated criterion']
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('feedback-subjects')).subjects[0].assessments[0].categories.map(category => category.name))).toEqual(expectedNames)
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('feedback-subjects')).subjects[0].assessments)
  expect(stored[1].categories).toEqual([])
  expect(new Set(stored[0].categories.map(category => category.id)).size).toBe(4)
  expect(stored[0].categories.map(category => category.order)).toEqual([0, 1, 2, 3])
  expect(stored[0].categories.every(category => category.allocatedMarks === undefined)).toBe(true)
  await rowSelect(page, firstLabel).selectOption('Evaluation')
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('feedback-assessment-s-a')).tableRowCategoryMap)).toEqual({ '1.1 problem relevance and context definition': 'Evaluation' })
  await page.reload()
  await page.getByRole('button', { name: 'Open subject Rubric QA', exact: true }).click()
  await page.getByRole('button', { name: /Open Feedback/ }).first().click()
  await page.locator('.feedback-tab-bar').getByRole('button', { name: /Settings/ }).click()
  await page.getByRole('button', { name: 'Show HTML input', exact: true }).click()
  await expect(rowSelect(page, firstLabel)).toHaveValue('Evaluation')
  await expect(rowSelect(page, firstLabel).locator('option')).toHaveCount(5)
  await captureCategoryCreation(page, 'created')
  expect(errors).toEqual([])
})

async function captureCategoryCreation(page, state) {
  const close = page.getByRole('button', { name: 'Close notification', exact: true })
  if (await close.isVisible()) await close.click()
  const section = page.getByText('Match table rows to categories', { exact: true }).locator('../..')
  for (const theme of ['light', 'dark']) {
    if (theme === 'dark') await page.getByRole('button', { name: 'Switch to Dark Mode', exact: true }).click()
    for (const width of [375, 768, 1280]) {
      await page.setViewportSize({ width, height: 1000 })
      await section.evaluate(element => element.scrollIntoView({ block: 'center' }))
      await section.screenshot({ path: `/tmp/rubric-category-${state}-${theme}-${width}.png` })
    }
  }
  await page.getByRole('button', { name: 'Switch to Light Mode', exact: true }).click()
}

test('creating rubric categories preserves different learning outcomes without duplicating headings', async ({ page }) => {
  await openMatching(page, true)
  await page.locator('#assessmentHtmlInput').fill('<table><tr><th>Criterion</th><th>Descriptor</th></tr><tr><td>Evaluation (LO1)</td><td>First outcome.</td></tr><tr><td>Evaluation (LO2)</td><td>Second outcome.</td></tr><tr><td>evaluation (LO1)</td><td>Repeated heading.</td></tr></table>')
  await page.getByRole('button', { name: 'Create categories from rubric', exact: true }).click()
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('feedback-subjects')).subjects[0].assessments[0].categories.map(category => category.name))).toEqual(['Evaluation (LO1)', 'Evaluation (LO2)'])
  await expect(rowSelect(page, 'Evaluation (LO1)').locator('option:checked')).toHaveText('Auto: Evaluation (LO1)')
  await expect(rowSelect(page, 'Evaluation (LO2)').locator('option:checked')).toHaveText('Auto: Evaluation (LO2)')
})


test('creates different learning outcomes individually without treating them as the same heading', async ({ page }) => {
  await openMatching(page, true)
  await page.locator('#assessmentHtmlInput').fill('<table><tr><th>Criterion</th><th>Descriptor</th></tr><tr><td>Evaluation (LO1)</td><td>First outcome.</td></tr><tr><td>Evaluation (LO2)</td><td>Second outcome.</td></tr></table>')
  await rowSelect(page, 'Evaluation (LO1)').selectOption({ label: 'Create category from this row' })
  await expect(rowSelect(page, 'Evaluation (LO2)').locator('option:checked')).toHaveText('No automatic match — choose a category')
  await rowSelect(page, 'Evaluation (LO2)').selectOption({ label: 'Create category from this row' })
  await expect(rowSelect(page, 'Evaluation (LO1)').locator('option:checked')).toHaveText('Auto: Evaluation (LO1)')
  await expect(rowSelect(page, 'Evaluation (LO2)').locator('option:checked')).toHaveText('Auto: Evaluation (LO2)')
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('feedback-subjects')).subjects[0].assessments[0].categories.map(category => category.name))).toEqual(['Evaluation (LO1)', 'Evaluation (LO2)'])
})
