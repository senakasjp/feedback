import { test, expect } from '@playwright/test'

test('Settings percentages drive feedback ranges and persist per assessment', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    if (localStorage.getItem('percentage-test-seeded')) return
    const assessments = ['A', 'B'].map(id => ({
      id, name: `Assessment ${id}`, topics: [], knowledgeAreas: [],
      categories: [{ id: 'c', name: 'Project', allocatedMarks: 20, markingMode: 'percentage' }],
      percentageRanges: [], totalMarks: 20, markingMode: 'percentage'
    }))
    localStorage.setItem('feedback-subjects', JSON.stringify({ subjects: [{ id: 's', name: 'Range QA', assessments }], students: [], percentageRanges: [] }))
    for (const id of ['A', 'B']) localStorage.setItem(`feedback-assessment-s-${id}`, JSON.stringify({ paragraphs: [{ id: 'p', text: 'Project: Strong implementation.', color: 'green', _source: 'assignment' }], selectedParagraphs: [], categoryMarks: {} }))
    localStorage.setItem('feedback-navigation-state-v1', JSON.stringify({ view: 'subjects' }))
    localStorage.setItem('percentage-test-seeded', 'true')
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Open subject Range QA', exact: true }).click()
  await page.getByRole('button', { name: /Open Feedback/ }).first().click()
  await expect(page.getByRole('button', { name: /Show Calculator/ })).toHaveCount(0)
  const badge = page.locator('.paragraph-item .badge.bg-info')
  await expect(badge).toHaveText('16–20')
  await page.locator('.feedback-tab-bar').getByRole('button', { name: /Settings/ }).click()
  await expect(page.getByRole('spinbutton', { name: 'Band 1 lower percentage', exact: true })).toHaveValue('80')
  await page.getByRole('spinbutton', { name: 'Band 1 lower percentage', exact: true }).fill('90')
  await page.getByRole('spinbutton', { name: 'Band 2 upper percentage', exact: true }).fill('90')
  await page.getByRole('button', { name: 'Save mark percentages', exact: true }).click()
  await page.getByRole('button', { name: /Enter Data$/ }).click()
  await expect(badge).toHaveText('18–20')
  await page.reload()
  await page.getByRole('button', { name: 'Open subject Range QA', exact: true }).click()
  await page.getByRole('button', { name: /Open Feedback/ }).first().click()
  await expect(badge).toHaveText('18–20')
  await page.locator('.feedback-tab-bar').getByRole('button', { name: /Settings/ }).click()
  await expect(page.getByRole('spinbutton', { name: 'Band 1 lower percentage', exact: true })).toHaveValue('90')
  await page.getByRole('spinbutton', { name: 'Band 1 lower percentage', exact: true }).fill('60')
  await page.getByRole('button', { name: 'Save mark percentages', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'non-overlapping' })).toBeVisible()
  await page.getByRole('button', { name: /Enter Data$/ }).click()
  await expect(badge).toHaveText('18–20')
  await page.locator('.app-sidebar-column').getByRole('button', { name: /Back to Assessments/ }).click()
  await page.getByRole('button', { name: /Open Feedback/ }).nth(1).click()
  await expect(badge).toHaveText('16–20')
  await page.locator('.feedback-tab-bar').getByRole('button', { name: /Settings/ }).click()
  await expect(page.getByRole('spinbutton', { name: 'Band 1 lower percentage', exact: true })).toHaveValue('80')
  expect(errors).toEqual([])
})
