import { test, expect } from '@playwright/test'

const rubric = maximum => `<table><thead><tr><th>Criterion</th><th>Excellent</th><th>Good</th><th>Partial</th><th>Missing</th><th>Marks</th></tr></thead><tbody><tr><td>Project</td><td>Strong evidence</td><td>Good evidence</td><td>Partial evidence</td><td>No evidence</td><td>${maximum}</td></tr></tbody></table>`
const card = page => page.locator('.card.border-start').filter({ has: page.getByRole('heading', { name: 'Project', exact: true }) })
const warning = page => card(page).locator('.alert-warning')
const mark = page => page.getByRole('spinbutton', { name: 'Marks for Project', exact: true })
const selectedBand = (page, color) => card(page).locator('.paragraph-item').filter({ hasText: `Feedback for ${color}.` }).getByRole('checkbox')

async function openMarking(page, markingMode = 'none', maximum = 25) {
  await page.addInitScript(({ markingMode, html }) => {
    if (localStorage.getItem('band-warning-seeded')) return
    localStorage.clear()
    localStorage.setItem('feedback-subjects', JSON.stringify({ subjects: [{ id: 's', name: 'Band Warning QA', assessments: [{
      id: 'a', name: 'Warning assessment', topics: [], knowledgeAreas: [], totalMarks: 25, markingMode,
      categories: [{ id: 'project', name: 'Project', markingMode, allocatedMarks: 10, colorMarks: { red: 0, green: 25 } }],
      rubricHtml: html,
      percentageRanges: [
        { color: 'green', lowerPercentage: 80, upperPercentage: 100 },
        { color: 'yellow', lowerPercentage: 50, upperPercentage: 80 },
        { color: 'orange', lowerPercentage: 25, upperPercentage: 50 },
        { color: 'red', lowerPercentage: 0, upperPercentage: 25 }
      ]
    }] }], students: [{ id: 'student', name: 'Synthetic Warning Student', displayName: 'Synthetic Warning Student' }, { id: 'other', name: 'Another Synthetic Student', displayName: 'Another Synthetic Student' }], percentageRanges: [] }))
    localStorage.setItem('feedback-assessment-s-a', JSON.stringify({ paragraphs: ['green', 'yellow', 'orange', 'red', 'lightgreen'].map(color => ({ id: color, text: `Project: Feedback for ${color}.`, color, _source: 'assignment' })), selectedParagraphs: [], categoryMarks: {} }))
    localStorage.setItem('feedback-navigation-state-v1', JSON.stringify({ view: 'subjects' }))
    localStorage.setItem('band-warning-seeded', 'true')
  }, { markingMode, html: maximum === null ? '' : rubric(maximum) })
  await page.goto('/')
  await page.getByRole('button', { name: 'Open subject Band Warning QA', exact: true }).click()
  await page.getByRole('button', { name: /Open Feedback/ }).click()
  await page.getByRole('button', { name: 'Student:', exact: true }).click()
  await page.getByRole('button', { name: /Synthetic Warning Student/ }).click()
}

for (const mode of ['none', 'percentage']) {
  test(`warns for mismatched selected bands in ${mode} mode using rubric marks`, async ({ page }) => {
    await openMarking(page, mode)
    await selectedBand(page, 'green').check()
    await mark(page).fill('10')
    await expect(warning(page)).toContainText('do not match')
    await expect(warning(page)).toContainText('20')
    await expect(warning(page)).toContainText('25')
    await expect(mark(page)).toHaveValue('10')
    await expect(selectedBand(page, 'green')).toBeChecked()
    await mark(page).fill('20')
    await expect(warning(page)).toHaveCount(0)
    await selectedBand(page, 'yellow').check()
    await expect(warning(page)).toContainText('do not match')
    await selectedBand(page, 'green').uncheck()
    await mark(page).fill('19.5')
    await expect(warning(page)).toHaveCount(0)
    await mark(page).fill('')
    await expect(warning(page)).toContainText('no marks entered')
    await selectedBand(page, 'yellow').uncheck()
    await selectedBand(page, 'red').check()
    await mark(page).fill('0')
    await expect(warning(page)).toHaveCount(0)
    await selectedBand(page, 'red').uncheck()
    await expect(warning(page)).toContainText('No feedback paragraphs selected')
  })
}

test('warnings refresh when the rubric maximum changes without editing the awarded mark', async ({ page }) => {
  await openMarking(page, 'percentage')
  await selectedBand(page, 'green').check()
  await mark(page).fill('20')
  await expect(warning(page)).toHaveCount(0)
  await page.locator('.feedback-tab-bar').getByRole('button', { name: /Settings/ }).click()
  const show = page.getByRole('button', { name: /Show HTML input/ })
  if (await show.isVisible()) await show.click()
  await page.locator('#assessmentHtmlInput').fill(rubric(30))
  await page.getByRole('button', { name: /Enter Data$/ }).click()
  await expect(warning(page)).toContainText('do not match')
  await expect(warning(page)).toContainText('24')
  await expect(mark(page)).toHaveValue('20')
})

test('fixed zero and unconfigured colour bands retain their existing behaviour', async ({ page }) => {
  await openMarking(page, 'fixed')
  await selectedBand(page, 'red').check()
  await mark(page).fill('1')
  await expect(warning(page)).toContainText('0 marks')
  await mark(page).fill('0')
  await expect(warning(page)).toHaveCount(0)
  await selectedBand(page, 'red').uncheck()
  await selectedBand(page, 'lightgreen').check()
  await expect(warning(page)).toHaveCount(0)
})

test('saved warnings reload and clear on student changes without altering marks or feedback', async ({ page }) => {
  await openMarking(page)
  await selectedBand(page, 'green').check()
  await mark(page).fill('10')
  await page.getByRole('button', { name: /Save Student Data/ }).click()
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('student-evaluation-student-a')).categoryMarks.Project)).toBe(10)
  await page.evaluate(() => localStorage.setItem('feedback-navigation-state-v1', JSON.stringify({ view: 'subjects' })))
  await openMarking(page)
  await expect(warning(page)).toContainText('green colour band (20–25 marks)')
  await expect(mark(page)).toHaveValue('10')
  await expect(selectedBand(page, 'green')).toBeChecked()
  await expect(card(page).locator('.paragraph-item')).toHaveCount(5)
  await page.getByRole('button', { name: 'Student:', exact: true }).click()
  await page.getByRole('button', { name: /Another Synthetic Student/ }).click()
  await expect(warning(page)).toHaveCount(0)
  await expect(mark(page)).toHaveValue('')
  await expect(selectedBand(page, 'green')).not.toBeChecked()
})

test('warnings follow saved Settings bands and wrap in both themes', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await openMarking(page, 'none', null)
  await selectedBand(page, 'green').check()
  await mark(page).fill('8')
  await expect(warning(page)).toHaveCount(0)
  await page.locator('.feedback-tab-bar').getByRole('button', { name: /Settings/ }).click()
  await page.getByRole('spinbutton', { name: 'Band 1 lower percentage', exact: true }).fill('90')
  await page.getByRole('spinbutton', { name: 'Band 2 upper percentage', exact: true }).fill('90')
  await page.getByRole('button', { name: 'Save mark percentages', exact: true }).click()
  await page.getByRole('button', { name: /Enter Data$/ }).click()
  await expect(warning(page)).toContainText('green colour band (9–10 marks)')
  await expect(warning(page)).toHaveAttribute('role', 'alert')
  const closeNotification = page.getByRole('button', { name: 'Close notification', exact: true })
  if (await closeNotification.isVisible()) await closeNotification.click()
  for (const theme of ['light', 'dark']) {
    const toggle = page.getByRole('button', { name: `Switch to ${theme === 'dark' ? 'Dark' : 'Light'} Mode`, exact: true })
    if (await toggle.isVisible()) await toggle.click()
    for (const width of [375, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 })
      await expect(warning(page)).toBeVisible()
      expect(await warning(page).evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
      await card(page).screenshot({ animations: 'disabled', path: `/tmp/feedback-band-warning-${theme}-${width}.png` })
    }
  }
  await mark(page).fill('9')
  await expect(warning(page)).toHaveCount(0)
  await selectedBand(page, 'green').uncheck()
  await selectedBand(page, 'lightgreen').check()
  await expect(warning(page)).toHaveCount(0)
  expect(errors).toEqual([])
})
