import { test, expect } from '@playwright/test'

const headings = ['1.1 Purpose (LO1)', '2.1 Design (LO3)']
const colors = ['red', 'orange', 'yellow', 'lightgreen', 'green']
const rubric = `<table><thead><tr><th rowspan="2">Criterion</th><th rowspan="2">Weight (%)</th><th colspan="5">Performance levels</th><th rowspan="2">Marks</th></tr><tr>${['Fail (0–39%)', 'Weak (40–49%)', 'Adequate (50–64%)', 'Good (65–79%)', 'Excellent (80–100%)'].map(label => `<th>${label}</th>`).join('')}</tr></thead><tbody>${headings.map((heading, row) => `<tr><td>${heading}</td><td>50</td>${colors.map(color => `<td>${color} description for criterion ${row + 1}.</td>`).join('')}<td></td></tr>`).join('')}</tbody></table>`

async function openRubric(page, createCategories, options = {}) {
  await page.addInitScript(({ headings, rubric, createCategories, percentageRanges, paragraphs }) => {
    if (localStorage.getItem('autofill-seeded')) return
    const categories = createCategories ? [] : headings.map((name, index) => ({ id: `c${index}`, name, order: index, markingMode: 'percentage', allocatedMarks: 50 }))
    localStorage.setItem('feedback-subjects', JSON.stringify({ subjects: [{ id: 's', name: 'Autofill QA', assessments: [{ id: 'a', name: 'Rubric', categories, rubricHtml: rubric, totalMarks: 100, markingMode: 'percentage', percentageRanges, topics: [], knowledgeAreas: [] }] }], students: [], percentageRanges: [] }))
    localStorage.setItem('feedback-assessment-s-a', JSON.stringify({ paragraphs, rubricHtml: rubric, tableColumnMarkMap: {} }))
    localStorage.setItem('feedback-navigation-state-v1', JSON.stringify({ view: 'subjects' }))
    localStorage.setItem('autofill-seeded', 'true')
  }, { headings, rubric, createCategories, percentageRanges: [], paragraphs: [], ...options })
  await page.goto('/')
  await page.getByRole('button', { name: 'Open subject Autofill QA', exact: true }).click()
  await page.getByRole('button', { name: /Open Feedback/ }).click()
  await page.locator('.feedback-tab-bar').getByRole('button', { name: /Settings/ }).click()
  await page.getByRole('button', { name: 'Show HTML input', exact: true }).click()
  if (createCategories) await page.getByRole('button', { name: 'Create categories from rubric', exact: true }).click()
}

for (const createCategories of [true, false]) {
  test(`fills real rubric descriptions without manual column mappings (${createCategories ? 'new categories without marks' : 'configured categories'})`, async ({ page }) => {
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await openRubric(page, createCategories)
    if (!createCategories) await captureSection(page, page.getByText('Map colour bands to rubric columns', { exact: true }).locator('../..'), 'columns-five')
    await page.locator('.feedback-tab-bar').getByRole('button', { name: /Enter Data/ }).click()
    await page.getByRole('button', { name: /Fill All Category Color Bands/ }).click()
    await expect(page.locator('.paragraph-item')).toHaveCount(10)
    const paragraphs = await page.evaluate(() => JSON.parse(localStorage.getItem('feedback-assessment-s-a')).paragraphs)
    for (const [row, heading] of headings.entries()) {
      for (const color of colors) expect(paragraphs.find(p => p.color === color && p.text.startsWith(heading + ': '))?.text).toBe(`${heading}: ${color} description for criterion ${row + 1}.`)
    }
    expect(paragraphs.every(p => !p.text.includes('[add feedback'))).toBe(true)
    await page.getByRole('button', { name: /Fill All Category Color Bands/ }).click()
    await expect(page.locator('.paragraph-item')).toHaveCount(10)
    if (!createCategories) await captureSection(page, page.locator('.paragraph-item').first().locator('..'), 'populated-five')
    expect(errors).toEqual([])
  })
}

test('does not create empty placeholder paragraphs when rubric columns cannot be identified', async ({ page }) => {
  await openRubric(page, false)
  await page.locator('#assessmentHtmlInput').fill('<table><tr><th>Criterion</th><th>Alpha</th><th>Beta</th></tr><tr><td>1.1 Purpose (LO1)</td><td>Some text.</td><td>Other text.</td></tr></table>')
  await page.locator('.feedback-tab-bar').getByRole('button', { name: /Enter Data/ }).click()
  await page.getByRole('button', { name: /Fill All Category Color Bands/ }).click()
  await expect(page.locator('.paragraph-item')).toHaveCount(0)
  await expect(page.locator('.toast-body')).toContainText('Map rubric columns in Settings')
})

const fourColors = ['red', 'orange', 'yellow', 'green']
const fourRanges = fourColors.map((color, index) => ({ color, lowerPercentage: [0, 40, 60, 80][index], upperPercentage: [40, 60, 80, 100][index] }))
const fourRubric = `<table><tr><th>Criterion</th>${['0–39%', '40–59%', '60–79%', '80–100%'].map(label => `<th>${label}</th>`).join('')}</tr>${headings.map((heading, row) => `<tr><td>${heading}</td>${fourColors.map(color => `<td>${color} description for criterion ${row + 1}.</td>`).join('')}</tr>`).join('')}</table>`

test('fills four bands using assessment settings, persists them and never creates a fifth', async ({ page }) => {
  await openRubric(page, true, { rubric: fourRubric, percentageRanges: fourRanges })
  await expect(page.getByRole('combobox', { name: 'Column for green band', exact: true }).locator('option:checked')).toHaveText('Auto: 80–100%')
  await expect(page.getByRole('combobox', { name: 'Column for lightgreen band', exact: true }).locator('option:checked')).toHaveText('Auto: no matching column')
  await captureSection(page, page.getByText('Map colour bands to rubric columns', { exact: true }).locator('../..'), 'columns-four')
  await page.locator('.feedback-tab-bar').getByRole('button', { name: /Enter Data/ }).click()
  await page.getByRole('button', { name: /Fill All Category Color Bands/ }).click()
  await expect(page.locator('.paragraph-item')).toHaveCount(8)
  const paragraphs = await page.evaluate(() => JSON.parse(localStorage.getItem('feedback-assessment-s-a')).paragraphs)
  expect(paragraphs.some(p => p.color === 'lightgreen')).toBe(false)
  for (const [row, heading] of headings.entries()) {
    for (const color of fourColors) expect(paragraphs.find(p => p.color === color && p.text.startsWith(heading + ': '))?.text).toBe(`${heading}: ${color} description for criterion ${row + 1}.`)
  }
  await page.getByRole('button', { name: /Fill All Category Color Bands/ }).click()
  await expect(page.locator('.paragraph-item')).toHaveCount(8)
  await captureSection(page, page.locator('.paragraph-item').first().locator('..'), 'populated-four')
  await page.reload()
  await page.getByRole('button', { name: 'Open subject Autofill QA', exact: true }).click()
  await page.getByRole('button', { name: /Open Feedback/ }).click()
  await expect(page.locator('.paragraph-item')).toHaveCount(8)
})

test('honours a manual column choice and an unused band across reloads', async ({ page }) => {
  await openRubric(page, false, { rubric: fourRubric, percentageRanges: fourRanges })
  await page.getByRole('combobox', { name: 'Column for green band', exact: true }).selectOption('3')
  await page.getByRole('combobox', { name: 'Column for yellow band', exact: true }).selectOption('')
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('feedback-assessment-s-a')).tableColumnMarkMap)).toEqual({ 1: 3, 3: '' })
  await page.reload()
  await page.getByRole('button', { name: 'Open subject Autofill QA', exact: true }).click()
  await page.getByRole('button', { name: /Open Feedback/ }).click()
  await page.getByRole('button', { name: /Fill All Category Color Bands/ }).click()
  await expect(page.locator('.paragraph-item')).toHaveCount(6)
  const paragraphs = await page.evaluate(() => JSON.parse(localStorage.getItem('feedback-assessment-s-a')).paragraphs)
  expect(paragraphs.some(p => p.color === 'yellow')).toBe(false)
  expect(paragraphs.find(p => p.color === 'green').text).toContain('yellow description')
  await page.locator('.feedback-tab-bar').getByRole('button', { name: /Settings/ }).click()
  await page.getByRole('button', { name: 'Show HTML input', exact: true }).click()
  await page.getByRole('combobox', { name: 'Column for green band', exact: true }).selectOption('auto')
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('feedback-assessment-s-a')).tableColumnMarkMap)).toEqual({ 3: '' })
})

async function captureSection(page, section, name) {
  const close = page.getByRole('button', { name: 'Close notification', exact: true })
  if (await close.isVisible()) await close.click()
  for (const theme of ['light', 'dark']) {
    if (theme === 'dark') await page.getByRole('button', { name: 'Switch to Dark Mode', exact: true }).click()
    for (const width of [375, 768, 1280]) {
      await page.setViewportSize({ width, height: 1000 })
      await section.evaluate(element => element.scrollIntoView({ block: 'center' }))
      await section.screenshot({ path: `/tmp/rubric-${name}-${theme}-${width}.png` })
    }
  }
  await page.getByRole('button', { name: 'Switch to Light Mode', exact: true }).click()
}


test('repairs old four-band placeholders without retaining an unused fifth or removing written feedback', async ({ page }) => {
  const paragraphs = colors.map(color => ({ id: `old-${color}`, color, text: `${headings[0]}: ${color === 'green' ? 'My written feedback.' : '[add feedback for this band]'}`, _source: 'assignment' }))
  await openRubric(page, false, { rubric: fourRubric, percentageRanges: fourRanges, paragraphs })
  await page.locator('.feedback-tab-bar').getByRole('button', { name: /Enter Data/ }).click()
  await page.getByRole('button', { name: /Fill All Category Color Bands/ }).click()
  await expect(page.locator('.paragraph-item')).toHaveCount(8)
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('feedback-assessment-s-a')).paragraphs)
  expect(saved.some(p => p.text.includes('[add feedback'))).toBe(false)
  expect(saved.find(p => p.id === 'old-green').text).toBe(`${headings[0]}: My written feedback.`)
  expect(saved.find(p => p.id === 'old-red').text).toBe(`${headings[0]}: red description for criterion 1.`)
})
