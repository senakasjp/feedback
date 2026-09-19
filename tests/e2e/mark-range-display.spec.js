import { test, expect } from '@playwright/test'

async function openRanges(page, category) {
  await page.addInitScript(category => {
    localStorage.clear()
    localStorage.setItem('feedback-subjects', JSON.stringify({ subjects: [{ id: 's', name: 'Range Display QA', assessments: [{
      id: 'a', name: 'Range assessment', topics: [], knowledgeAreas: [], totalMarks: 20, markingMode: 'none',
      categories: [{ id: 'project', name: 'Project', ...category }],
      percentageRanges: [
        { color: 'green', lowerPercentage: 80, upperPercentage: 100 },
        { color: 'yellow', lowerPercentage: 50, upperPercentage: 80 },
        { color: 'orange', lowerPercentage: 25, upperPercentage: 50 },
        { color: 'red', lowerPercentage: 0, upperPercentage: 25 }
      ]
    }] }], students: [{ id: 'student', name: 'Synthetic Range Student', displayName: 'Synthetic Range Student' }], percentageRanges: [] }))
    localStorage.setItem('feedback-assessment-s-a', JSON.stringify({ paragraphs: [
      { id: 'green', text: 'Project: Strong implementation.', color: 'green', _source: 'assignment' },
      { id: 'red', text: 'Project: Missing implementation.', color: 'red', _source: 'assignment' },
      { id: 'lightgreen', text: 'Project: Unconfigured band.', color: 'lightgreen', _source: 'assignment' }
    ], selectedParagraphs: ['red'], categoryMarks: { Project: 3 } }))
    localStorage.setItem('feedback-navigation-state-v1', JSON.stringify({ view: 'subjects' }))
  }, category)
  await page.goto('/')
  const stored = await page.evaluate(() => localStorage.getItem('feedback-assessment-s-a'))
  await page.getByRole('button', { name: 'Open subject Range Display QA', exact: true }).click()
  await page.getByRole('button', { name: /Open Feedback/ }).click()
  return stored
}

const row = (page, text) => page.locator('.paragraph-item').filter({ hasText: text })
const range = (page, text) => row(page, text).locator('.badge.bg-info')

for (const numeric of [false, true]) {
  test(`shows configured ${numeric ? 'numeric' : 'percentage'} ranges for legacy none-mode headings without changing saved data`, async ({ page }) => {
    const stored = await openRanges(page, numeric ? { markingMode: 'none', allocatedMarks: '20' } : {})
    await expect(range(page, 'Strong implementation.')).toHaveText(numeric ? '16–20' : '80–100%')
    await expect(range(page, 'Missing implementation.')).toHaveText(numeric ? '0–<5' : '0–<25%')
    await expect(range(page, 'Unconfigured band.')).toHaveCount(0)
    expect(await page.evaluate(() => localStorage.getItem('feedback-assessment-s-a'))).toBe(stored)
    const card = page.locator('.card.border-start').filter({ has: row(page, 'Strong implementation.') })
    for (const theme of ['light', 'dark']) {
      if (theme === 'dark') await page.getByRole('button', { name: 'Switch to Dark Mode', exact: true }).click()
      for (const width of [375, 768, 1280]) {
        await page.setViewportSize({ width, height: 900 })
        await card.screenshot({ animations: 'disabled', path: `/tmp/mark-ranges-${numeric ? 'numeric' : 'percentage'}-${theme}-${width}.png` })
      }
    }
    await page.locator('.feedback-tab-bar').getByRole('button', { name: /Settings/ }).click()
    await page.getByRole('spinbutton', { name: 'Band 1 lower percentage', exact: true }).fill('90')
    await page.getByRole('spinbutton', { name: 'Band 2 upper percentage', exact: true }).fill('90')
    await page.getByRole('button', { name: 'Save mark percentages', exact: true }).click()
    await page.getByRole('button', { name: /Enter Data$/ }).click()
    await expect(range(page, 'Strong implementation.')).toHaveText(numeric ? '18–20' : '90–100%')
    await page.getByRole('button', { name: 'Student:', exact: true }).click()
    await page.getByRole('button', { name: /Synthetic Range Student/ }).click()
    await expect(range(page, 'Strong implementation.')).toHaveText(numeric ? '18–20' : '90–100%')
    await expect(row(page, 'Strong implementation.').getByRole('checkbox')).not.toBeChecked()
    if (numeric) await expect(page.getByRole('spinbutton', { name: 'Marks for Project', exact: true })).toHaveValue('')
    expect(await page.evaluate(() => localStorage.getItem('student-evaluation-student-a'))).toBeNull()
  })
}

test('fixed zero remains a fixed mark and missing fixed colours do not acquire percentage ranges', async ({ page }) => {
  const stored = await openRanges(page, { markingMode: 'fixed', allocatedMarks: 20, colorMarks: { red: 0, green: 20 } })
  await expect(row(page, 'Missing implementation.')).toContainText('0 marks')
  await expect(row(page, 'Strong implementation.')).toContainText('20 marks')
  await expect(range(page, 'Unconfigured band.')).toHaveCount(0)
  await expect(row(page, 'Unconfigured band.')).not.toContainText('%')
  expect(await page.evaluate(() => localStorage.getItem('feedback-assessment-s-a'))).toBe(stored)
})

test('category marks shortcut configures a maximum and converts percentage badges to marks', async ({ page }) => {
  await openRanges(page, {})
  await expect(range(page, 'Strong implementation.')).toHaveText('80–100%')
  await page.getByRole('button', { name: 'Set category marks for Project', exact: true }).click()
  const modal = page.locator('.modal.show')
  await expect(modal).toContainText('Edit Category: Project')
  await modal.getByRole('combobox').selectOption('percentage')
  await modal.locator('#editAllocatedMarks').fill('20')
  await modal.getByRole('button', { name: /Save Changes$/ }).click()
  await expect(modal).toHaveCount(0)
  await expect(range(page, 'Strong implementation.')).toHaveText('16–20')
  await expect(page.getByRole('button', { name: 'Set category marks for Project', exact: true })).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('feedback-subjects')).subjects[0].assessments[0].categories[0].allocatedMarks)).toBe(20)
})
