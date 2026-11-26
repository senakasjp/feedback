import { test, expect } from '@playwright/test'

test('submission box explains the automatic report folder when a student is selected', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))

  await page.addInitScript(() => {
    if (localStorage.getItem('student-materials-test-seeded')) return
    localStorage.setItem('feedback-subjects', JSON.stringify({
      subjects: [{
        id: 's',
        name: 'Materials QA',
        assessments: [{
          id: 'a',
          name: 'Materials Assessment',
          topics: [],
          knowledgeAreas: [],
          categories: [{ id: 'c', name: 'Evidence', allocatedMarks: 20, markingMode: 'percentage' }],
          percentageRanges: [],
          totalMarks: 20,
          markingMode: 'percentage'
        }]
      }],
      students: [{ id: 'student-1', name: 'Ankeet Patel', studentId: 'QA-001', displayName: 'Ankeet Patel (QA-001)' }],
      percentageRanges: []
    }))
    localStorage.setItem('feedback-assessment-s-a', JSON.stringify({
      paragraphs: [{ id: 'p', text: 'Evidence: Clear supporting evidence.', color: 'green', _source: 'assignment' }],
      selectedParagraphs: [],
      categoryMarks: {}
    }))
    localStorage.setItem('feedback-navigation-state-v1', JSON.stringify({ view: 'subjects' }))
    localStorage.setItem('student-materials-test-seeded', 'true')
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'Open subject Materials QA', exact: true }).click()
  await page.getByRole('button', { name: /Open Feedback/ }).first().click()
  await page.getByRole('button', { name: 'Student:', exact: true }).click()
  await page.getByRole('button', { name: /Ankeet Patel/ }).click()

  const submission = page.getByRole('textbox', { name: 'Student Submission or Evidence Notes Input' })
  await expect(submission).toBeEnabled()
  await expect(page.getByText('Script folder:')).toBeVisible()
  await expect(page.getByText('~/Documents/senaka-marking-materials/QA-001/')).toBeVisible()
  await expect(page.getByRole('button', { name: /Copy path/ })).toBeVisible()
  await expect(page.getByText('Nothing is saved until you save student data.')).toBeVisible()

  expect(errors).toEqual([])
})
