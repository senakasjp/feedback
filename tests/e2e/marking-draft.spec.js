import { test, expect } from '@playwright/test'

const criterion = { criterion_name: 'Safety', awarded_mark: 5, judgement: 'Partial evidence', evidence: ['Measured response time: 2 ms'], improvement_advice: 'Measure error rate', suggested_feedback: 'Add error measurements.' }

async function openDraft(page, responseCriteria) {
  await page.route('https://api.openai.com/**', async route => {
    const body = route.request().postDataJSON()
    const response = route.request().url().endsWith('/embeddings')
      ? { data: body.input.map(() => ({ embedding: [1, 0] })) }
      : { choices: [{ message: { content: JSON.stringify({ criteria: responseCriteria, overall_feedback: 'Partial evidence.' }) }, finish_reason: 'stop' }] }
    await route.fulfill({ json: response })
  })
  await page.addInitScript(() => {
    localStorage.clear()
    localStorage.setItem('feedback-ai-apikey-openai', 'synthetic-test-key')
    localStorage.setItem('feedback-subjects', JSON.stringify({
      subjects: [{ id: 's', name: 'Synthetic subject', assessments: [{ id: 'a', name: 'Synthetic assessment', topics: [], categories: [{ id: 'c', name: 'Safety', allocatedMarks: 10, description: 'Evaluate measurements' }], knowledgeAreas: [], aiReferenceDocuments: [], percentageRanges: [], totalMarks: 10, markingMode: 'category' }] }],
      students: [{ id: 'student', name: 'Sample Student', displayName: 'Sample Student' }],
      percentageRanges: [], appSettings: { aiMarkingSystemInstructions: '' }
    }))
    localStorage.setItem('feedback-navigation-state-v1', JSON.stringify({ view: 'subjects', subjectId: null, assessmentId: null, studentId: null }))
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Open subject Synthetic subject', exact: true }).click()
  await page.getByRole('button', { name: /Open Feedback/ }).click()
  await page.getByRole('button', { name: 'Student:', exact: true }).click()
  await page.getByRole('button', { name: /Sample Student/ }).click()
  await page.getByRole('textbox', { name: 'Student Submission or Evidence Notes Input' }).fill('Measured response time: 2 ms')
  await page.getByRole('button', { name: /Draft Feedback with AI/ }).click()
}

test('valid marking draft requires assessor review before applying', async ({ page }) => {
  await openDraft(page, [criterion])
  await expect(page.getByRole('heading', { name: /Review AI Draft/ })).toBeVisible()
  await expect(page.getByText('Suggested Mark: 5', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /Apply Selected Suggestions/ }).click()
  await expect(page.getByRole('heading', { name: /Review AI Draft/ })).not.toBeVisible()
  await expect(page.getByText('AI draft selections applied. Review and save when ready.', { exact: true })).toBeVisible()
})

test('incomplete marking draft is rejected before review or application', async ({ page }) => {
  await openDraft(page, [])
  await expect(page.getByText(/Failed to generate AI feedback: AI marking draft is missing criteria/)).toBeVisible()
  await expect(page.getByRole('heading', { name: /Review AI Draft/ })).not.toBeVisible()
})


test('manual marks enforce bounds, preserve zero and classify decimal percentages', async ({ page }) => {
  await openDraft(page, [criterion])
  await page.getByRole('button', { name: /Apply Selected Suggestions/ }).click()
  const mark = page.getByRole('spinbutton', { name: 'Marks for Safety', exact: true })
  await expect(mark).toHaveValue('5')
  await mark.fill('11')
  await expect(mark).toHaveValue('5')
  await expect(page.getByText(/Mark must not exceed 10/)).toBeVisible()
  await mark.fill('-1')
  await expect(mark).toHaveValue('5')
  await mark.fill('7.95')
  await expect(page.getByText('7.95 / 10 (79.5%) — B: Good', { exact: true })).toBeVisible()
  await mark.fill('0')
  await expect(mark).toHaveValue('0')
  await expect(page.getByText('0 / 10 (0.0%) — F: Fail', { exact: true })).toBeVisible()
  await page.screenshot({ path: '/tmp/feedback-marks-zero.png', fullPage: true })
  await page.getByRole('spinbutton', { name: 'Total Marks:', exact: true }).fill('20')
  await expect(page.getByRole('alert').filter({ hasText: 'Check allocation:' })).toBeVisible()
  await page.screenshot({ path: '/tmp/feedback-marks-mismatch.png', fullPage: true })
  await page.getByRole('spinbutton', { name: 'Total Marks:', exact: true }).fill('10')
  await mark.fill('')
  await expect(mark).toHaveValue('')
  await expect(page.getByText('0 / 10 (0.0%) — F: Fail', { exact: true })).not.toBeVisible()
})
