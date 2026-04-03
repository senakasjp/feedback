import { test, expect } from '@playwright/test'

function buildSeedData() {
  return {
    subjects: [
      {
        id: 'subject-studio-6',
        name: 'Studio 6',
        assessments: [
          {
            id: 'assessment-a',
            name: 'Assessment A',
            topics: [],
            categories: [],
            knowledgeAreas: [],
            aiAnswerInstructionsByCategory: {},
            aiReferenceDocuments: [],
            lockPdfPortrait: false,
            totalMarks: 0,
            percentageRanges: [],
            markingMode: 'none'
          }
        ]
      }
    ],
    students: [],
    percentageRanges: [],
    appSettings: {
      aiMarkingSystemInstructions: ''
    }
  }
}

test.describe('subject navigation', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => {
      console.log(`[browser:${msg.type()}] ${msg.text()}`)
    })
    page.on('pageerror', error => {
      console.log(`[browser:pageerror] ${error.stack || error.message}`)
    })

    await page.addInitScript((seedData) => {
      window.localStorage.clear()
      window.localStorage.setItem('feedback-subjects', JSON.stringify(seedData))
      window.localStorage.setItem('feedback-navigation-state-v1', JSON.stringify({
        view: 'subjects',
        subjectId: null,
        assessmentId: null,
        studentId: null
      }))
    }, buildSeedData())
  })

  test('clicking a subject opens the assessments screen without freezing', async ({ page }) => {
    const pageErrors = []
    page.on('pageerror', error => pageErrors.push(String(error)))

    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Subjects', exact: true })).toBeVisible()

    const subjectCardButton = page.getByRole('button', { name: /open subject studio 6/i })
    await expect(subjectCardButton).toBeVisible()
    await subjectCardButton.click()

    await expect(page.getByRole('heading', { name: 'Studio 6' })).toBeVisible()
    await expect(page.getByText('Manage assessments and categories')).toBeVisible()
    await expect(page.locator('.app-sidebar-column').getByRole('button', { name: /back to subjects/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /add assessment/i })).toBeVisible()

    expect(pageErrors).toEqual([])
  })

  test('clicking a subject in the sidebar also opens the assessments screen', async ({ page }) => {
    await page.goto('/')

    const sidebarSubjectButton = page.locator('.app-sidebar-column').getByRole('button', { name: /studio 6/i }).first()
    await expect(sidebarSubjectButton).toBeVisible()
    await sidebarSubjectButton.click()

    await expect(page.getByRole('heading', { name: 'Studio 6' })).toBeVisible()
    await expect(page.getByText('Manage assessments and categories')).toBeVisible()
  })

  test('the assessments screen stays responsive after selecting a subject', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: /open subject studio 6/i }).click()

    const addAssessmentButton = page.getByRole('button', { name: /add assessment/i })
    await expect(addAssessmentButton).toBeVisible()
    await addAssessmentButton.click()

    const subjectNameInput = page.getByLabel(/assessment name/i)
    await expect(subjectNameInput).toBeVisible()
    await subjectNameInput.fill('Freeze Check Assessment')

    await page.getByRole('button', { name: /add assessment/i }).last().click()

    await expect(page.getByRole('heading', { name: 'Freeze Check Assessment', exact: true })).toBeVisible()

    const backButton = page.getByRole('button', { name: /back to subjects/i }).last()
    await expect(backButton).toBeVisible()
    await backButton.click()

    await expect(page.getByRole('heading', { name: 'Subjects', exact: true })).toBeVisible()
  })
})
