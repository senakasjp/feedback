import { test, expect } from '@playwright/test'

test('Settings shows the rubric folder for the open assessment', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))

  await page.addInitScript(() => {
    if (localStorage.getItem('rubric-folder-test-seeded')) return
    localStorage.setItem('feedback-subjects', JSON.stringify({
      subjects: [{
        id: 's',
        name: 'Rubric QA',
        assessments: [{
          id: 'a',
          name: 'Research and Communication',
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
      categoryMarks: {},
      aiReferenceDocuments: []
    }))
    localStorage.setItem('feedback-navigation-state-v1', JSON.stringify({ view: 'subjects' }))
    localStorage.setItem('rubric-folder-test-seeded', 'true')
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'Open subject Rubric QA', exact: true }).click()
  await page.getByRole('button', { name: /Open Feedback/ }).first().click()
  await page.locator('.feedback-tab-bar').getByRole('button', { name: /Settings/ }).click()

  await expect(page.getByText('Rubric folder:')).toBeVisible()
  await expect(page.getByText('~/Documents/senaka-marking-rubric/Research and Communication/')).toBeVisible()
  await expect(page.getByRole('button', { name: /Copy path/ })).toBeVisible()
  await expect(page.getByText('A rubric you uploaded yourself is never replaced.')).toBeVisible()

  expect(errors).toEqual([])
})
