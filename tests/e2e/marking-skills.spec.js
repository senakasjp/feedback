import { test, expect } from '@playwright/test'

test('Settings lists marking skills and explains the browser limitation', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))

  await page.addInitScript(() => {
    if (localStorage.getItem('marking-skills-test-seeded')) return
    localStorage.setItem('feedback-subjects', JSON.stringify({
      subjects: [{
        id: 's',
        name: 'Skills QA',
        assessments: [{
          id: 'a',
          name: 'Skills Assessment',
          topics: [],
          knowledgeAreas: [],
          categories: [{ id: 'c', name: 'Evidence', allocatedMarks: 20, markingMode: 'percentage' }],
          percentageRanges: [],
          totalMarks: 20,
          markingMode: 'percentage'
        }]
      }],
      students: [],
      percentageRanges: []
    }))
    localStorage.setItem('feedback-assessment-s-a', JSON.stringify({
      paragraphs: [{ id: 'p', text: 'Evidence: Clear supporting evidence.', color: 'green', _source: 'assignment' }],
      selectedParagraphs: [],
      categoryMarks: {}
    }))
    localStorage.setItem('feedback-navigation-state-v1', JSON.stringify({ view: 'subjects' }))
    localStorage.setItem('marking-skills-test-seeded', 'true')
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'Open subject Skills QA', exact: true }).click()
  await page.getByRole('button', { name: /Open Feedback/ }).first().click()
  await page.locator('.feedback-tab-bar').getByRole('button', { name: /Settings/ }).click()

  const panel = page.locator('.card').filter({ hasText: 'AI Marking Context' })
  await expect(panel.getByText('Marking Skills', { exact: true })).toBeVisible()
  await expect(panel.getByText('Skills are read from the desktop app. In the browser preview no skills can be loaded.')).toBeVisible()
  await expect(panel.getByText('0 of 0 active')).toBeVisible()

  const reload = panel.getByRole('button', { name: /Reload skills/ })
  await expect(reload).toBeEnabled()
  await reload.click()
  await expect(panel.getByText('Skills are read from the desktop app. In the browser preview no skills can be loaded.')).toBeVisible()

  expect(errors).toEqual([])
})
