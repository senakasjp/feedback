import { test, expect } from '@playwright/test'

for (const removeOld of [false, true]) {
test(`assessment creation persists after editing total marks, deletion=${removeOld}`,  async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('save-qa-seeded')) return
    localStorage.clear()
    localStorage.setItem('feedback-subjects', JSON.stringify({ subjects: [{ id: 's', name: 'Save QA', assessments: [{ id: 'old', name: 'Old assessment', totalMarks: 100, categories: [], topics: [] }] }], students: [] }))
    localStorage.setItem('feedback-navigation-state-v1', JSON.stringify({ view: 'subjects' }))
    localStorage.setItem('save-qa-seeded', 'true')
  })
  await page.setViewportSize({ width: 1800, height: 1100 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Open subject Save QA', exact: true }).click()
  await page.getByRole('button', { name: /Open Feedback/ }).click()
  await page.locator('#total-marks-input').fill('80')
  await page.getByRole('button', { name: /Back to Assessments/ }).first().click()
  if (removeOld) {
    await page.getByRole('button', { name: 'Delete assessment', exact: true }).click()
    await page.locator('.modal.show').getByRole('button', { name: /Delete/ }).click()
  }
  await page.getByRole('button', { name: /Add Assessment$/ }).first().click()
  await page.getByLabel('Assessment Name:').fill('New assessment')
  await page.getByRole('button', { name: /Add Assessment$/ }).last().click()
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('feedback-subjects')).subjects[0].assessments.map(a => a.name))).toEqual(removeOld ? ['New assessment'] : ['Old assessment', 'New assessment'])
  if (!removeOld) expect(await page.evaluate(() => JSON.parse(localStorage.getItem('feedback-subjects')).subjects[0].assessments[0].totalMarks)).toBe(80)
  if (!removeOld) {
    const cards = page.locator('.assessment-card')
    await expect(cards.first()).toContainText('Old assessment')
    await expect(cards.last()).toContainText('New assessment')
    const first = await cards.first().boundingBox()
    const last = await cards.last().boundingBox()
    expect(last.x).toBeGreaterThan(first.x)
    await cards.first().locator('..').screenshot({ path: '/tmp/assessment-card-order.png' })
  }
  await page.reload()
  const subject = page.getByRole('button', { name: 'Open subject Save QA', exact: true })
  if (await subject.isVisible()) await subject.click()
  await expect(page.getByRole('heading', { name: 'New assessment', exact: true })).toBeVisible()
  await expect(page.locator('.assessment-card').last()).toContainText('New assessment')
  await expect(page.getByRole('heading', { name: 'Old assessment', exact: true })).toHaveCount(removeOld ? 0 : 1)
})
}
