import { test, expect } from '@playwright/test'

const bands = [{ color: 'green', lowerPercentage: 80, upperPercentage: 100 }, { color: 'yellow', lowerPercentage: 50, upperPercentage: 80 }, { color: 'orange', lowerPercentage: 25, upperPercentage: 50 }, { color: 'red', lowerPercentage: 0, upperPercentage: 25 }]
const rubric = (label = 'Project', mark = '25') => `<table><thead><tr><th>Criterion</th><th>80–100%</th><th>50–79%</th><th>25–49%</th><th>0–24%</th><th>Marks</th></tr></thead><tbody><tr><td>${label}</td><td>Strong evidence</td><td>Good evidence</td><td>Partial evidence</td><td>No evidence</td><td>${mark}</td></tr></tbody></table>`
const card = (page, category = 'Project') => page.locator('.card.border-start').filter({ has: page.getByRole('heading', { name: category, exact: true }) })
const badge = (page, category = 'Project') => card(page, category).locator('.paragraph-item').filter({ hasText: 'Existing feedback' }).locator('.badge.bg-info')
const settings = async page => {
  await page.locator('.feedback-tab-bar').getByRole('button', { name: /Settings/ }).click()
  const show = page.getByRole('button', { name: /Show HTML input/ })
  if (await show.isVisible()) await show.click()
}
const enter = page => page.getByRole('button', { name: /Enter Data$/ }).click()

async function openRubric(page, categories, html = rubric()) {
  await page.addInitScript(({ categories, html, bands }) => {
    if (localStorage.getItem('rubric-marks-seeded')) return
    localStorage.clear()
    const assessments = ['a', 'b'].map(id => ({ id, name: `Rubric ${id}`, categories, rubricHtml: id === 'a' ? html : '', totalMarks: 25, markingMode: 'none', percentageRanges: bands, topics: [], knowledgeAreas: [] }))
    localStorage.setItem('feedback-subjects', JSON.stringify({ subjects: [{ id: 's', name: 'Rubric Marks QA', assessments }], students: [{ id: 'student', name: 'Synthetic Student', displayName: 'Synthetic Student' }], percentageRanges: [] }))
    for (const id of ['a', 'b']) localStorage.setItem(`feedback-assessment-s-${id}`, JSON.stringify({ paragraphs: categories.map((category, index) => ({ id: `p${index}`, text: `${category.name}: Existing feedback`, color: category.markingMode === 'fixed' ? 'red' : 'green', _source: 'assignment' })), selectedParagraphs: [], categoryMarks: {} }))
    localStorage.setItem('feedback-navigation-state-v1', JSON.stringify({ view: 'subjects' }))
    localStorage.setItem('rubric-marks-seeded', 'true')
  }, { categories, html, bands })
  await page.goto('/')
  await page.getByRole('button', { name: 'Open subject Rubric Marks QA', exact: true }).click()
  await page.getByRole('button', { name: /Open Feedback/ }).first().click()
}

async function captures(page, locator, prefix) {
  for (const theme of ['light', 'dark']) {
    const toggle = page.getByRole('button', { name: `Switch to ${theme === 'dark' ? 'Dark' : 'Light'} Mode`, exact: true })
    if (await toggle.isVisible()) await toggle.click()
    for (const width of [375, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 })
      await locator.screenshot({ animations: 'disabled', path: `/tmp/rubric-marks-${prefix}-${theme}-${width}.png` })
    }
  }
}

test('last Marks column drives numeric ranges and student maximum without rewriting category configuration', async ({ page }) => {
  await openRubric(page, [{ id: 'project', name: 'Project', markingMode: 'none', allocatedMarks: 10 }])
  const before = await page.evaluate(() => localStorage.getItem('feedback-assessment-s-a'))
  await expect(badge(page)).toHaveText('20–25')
  await expect(page.getByRole('spinbutton', { name: 'Marks for Project', exact: true })).toHaveAttribute('max', '25')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('feedback-subjects')).subjects[0].assessments[0].categories[0].allocatedMarks)).toBe(10)
  expect(await page.evaluate(() => localStorage.getItem('feedback-assessment-s-a'))).toBe(before)
  await captures(page, card(page), 'card')
  await page.reload()
  await page.getByRole('button', { name: 'Open subject Rubric Marks QA', exact: true }).click()
  await page.getByRole('button', { name: /Open Feedback/ }).first().click()
  await expect(badge(page)).toHaveText('20–25')
  await settings(page)
  const guidance = page.getByRole('note', { name: 'Rubric table format', exact: true })
  await expect(guidance).toBeVisible()
  await expect(guidance).toContainText(/Marks/)
  await captures(page, guidance, 'format')
  await page.getByRole('button', { name: 'Edit category marking mode', exact: true }).click()
  const modal = page.locator('.modal.show')
  await expect(modal).toContainText(/25 marks from the rubric/)
  await expect(modal).toContainText(/Configured category marks apply only/)
  await modal.screenshot({ animations: 'disabled', path: '/tmp/rubric-marks-modal-dark-1280.png' })
  await page.getByRole('button', { name: 'Close category edit modal', exact: true }).click()
  await page.getByRole('button', { name: 'Switch to Light Mode', exact: true }).click()
  await page.getByRole('button', { name: 'Edit category marking mode', exact: true }).click()
  await modal.screenshot({ animations: 'disabled', path: '/tmp/rubric-marks-modal-light-1280.png' })
  await page.getByRole('button', { name: 'Close category edit modal', exact: true }).click()
  await page.getByRole('spinbutton', { name: 'Band 1 lower percentage', exact: true }).fill('90')
  await page.getByRole('spinbutton', { name: 'Band 2 upper percentage', exact: true }).fill('90')
  await page.getByRole('button', { name: 'Save mark percentages', exact: true }).click()
  await enter(page)
  await expect(badge(page)).toHaveText('22.5–25')
  await page.getByRole('button', { name: 'Student:', exact: true }).click()
  await page.getByRole('button', { name: /Synthetic Student/ }).click()
  await expect(page.getByRole('button', { name: 'Assign marks for Project', exact: true })).toBeEnabled()
  const mark = page.getByRole('spinbutton', { name: 'Marks for Project', exact: true })
  await expect(mark).toHaveAttribute('max', '25')
  await expect(mark).toHaveValue('')
  await mark.fill('26')
  await expect(mark).toHaveValue('')
  await expect(page.getByRole('alert')).toContainText('25')
})

test('creates headings and four feedback bands from rubric while retaining row maximum', async ({ page }) => {
  await openRubric(page, [], rubric().replace('</tbody>', '<tr><td>Total</td><td></td><td></td><td></td><td></td><td>25</td></tr></tbody>'))
  await settings(page)
  await page.getByRole('button', { name: 'Create categories from rubric', exact: true }).click()
  await enter(page)
  await page.getByRole('button', { name: /Fill All Category Color Bands$/ }).click()
  await expect(page.locator('.paragraph-item')).toHaveCount(4)
  await expect(page.getByRole('heading', { name: 'Total', exact: true })).toHaveCount(0)
  await expect(page.locator('.paragraph-item').filter({ hasText: 'Strong evidence' }).locator('.badge.bg-info')).toHaveText('20–25')
  await expect(page.getByRole('spinbutton', { name: 'Marks for Project', exact: true })).toHaveAttribute('max', '25')
})

test('manual mapping moves inferred maximum and restores manual fallback with assessment isolation', async ({ page }) => {
  await openRubric(page, [{ id: 'project', name: 'Project', markingMode: 'percentage', allocatedMarks: 10 }, { id: 'other', name: 'Other', markingMode: 'percentage', allocatedMarks: 5 }], rubric('Rubric row'))
  await expect(badge(page)).toHaveText('8–10')
  await settings(page)
  await page.getByRole('combobox', { name: 'Category for Rubric row', exact: true }).selectOption('Project')
  await enter(page)
  await expect(badge(page)).toHaveText('20–25')
  await settings(page)
  await page.getByRole('combobox', { name: 'Category for Rubric row', exact: true }).selectOption('Other')
  await enter(page)
  await expect(badge(page)).toHaveText('8–10')
  await expect(badge(page, 'Other')).toHaveText('20–25')
  await page.locator('.app-sidebar-column').getByRole('button', { name: /Back to Assessments/ }).click()
  await page.getByRole('button', { name: /Open Feedback/ }).nth(1).click()
  await expect(badge(page)).toHaveText('8–10')
  await expect(badge(page, 'Other')).toHaveText('4–5')
})

test('invalid row maximum preserves manual fallback and fixed zero', async ({ page }) => {
  await openRubric(page, [{ id: 'project', name: 'Project', markingMode: 'none', allocatedMarks: 10 }, { id: 'fixed', name: 'Fixed', markingMode: 'fixed', allocatedMarks: 5, colorMarks: { red: 0 } }], rubric('Project', 'not a mark'))
  await expect(badge(page)).toHaveText('8–10')
  await expect(card(page, 'Fixed').locator('.paragraph-item')).toContainText('0 marks')
  await settings(page)
  await page.locator('#assessmentHtmlInput').fill(rubric('Project', ''))
  await enter(page)
  await expect(badge(page)).toHaveText('8–10')
})
