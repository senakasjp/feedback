import { test, expect } from '@playwright/test'

// "Improve with RAG" must still write feedback when the embeddings service is unreachable.
// Before this check, a refused embeddings call stopped the run before the chat request was ever
// made, so the comment box stayed empty and the only message was an opaque "Failed to fetch".
test('RAG still fills the comment box when embeddings cannot be reached', async ({ page }) => {
  const chatRequests = []
  await page.route('https://api.openai.com/**', async route => {
    const url = route.request().url()
    if (url.includes('/embeddings')) {
      await route.abort('failed')
      return
    }
    chatRequests.push(route.request().postDataJSON())
    await route.fulfill({
      json: {
        choices: [{
          finish_reason: 'stop',
          message: { content: 'The response time was measured at 2 ms. The limits of that measurement were not discussed.' }
        }]
      }
    })
  })

  await page.addInitScript(() => {
    localStorage.clear()
    localStorage.setItem('feedback-ai-apikey-openai', 'synthetic-test-key')
    localStorage.setItem('feedback-subjects', JSON.stringify({ subjects: [{ id: 's', name: 'Mark QA', assessments: [{
      id: 'a', name: 'Rubric assessment', totalMarks: 10, topics: [], knowledgeAreas: [], markingMode: 'percentage',
      categories: [{ id: 'safety', name: 'Safety', allocatedMarks: 10, description: 'Measure response time and discuss limits', markingMode: 'percentage' }],
      rubricHtml: '<table><tr><td>Safety: require measurements and discuss limitations</td></tr></table>'
    }] }], students: [{ id: 'student', name: 'Synthetic Student', displayName: 'Synthetic Student' }], percentageRanges: [] }))
    localStorage.setItem('feedback-assessment-s-a', JSON.stringify({ paragraphs: [
      { id: 'red', text: 'Safety: Limited evidence.', color: 'red', _source: 'assignment' }
    ], selectedParagraphs: [], categoryMarks: {} }))
    localStorage.setItem('feedback-navigation-state-v1', JSON.stringify({ view: 'subjects' }))
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'Open subject Mark QA', exact: true }).click()
  await page.getByRole('button', { name: /Open Feedback/ }).click()
  await page.getByRole('button', { name: 'Student:', exact: true }).click()
  await page.getByRole('button', { name: /Synthetic Student/ }).click()
  await page.getByRole('textbox', { name: 'Student Submission or Evidence Notes Input' }).fill('Measured response time: 2 ms.')
  await page.locator('#quick-add-Safety').fill('The response time was measured at 2 ms but the limits were not discussed.')

  const card = page.locator('.card.border-start').filter({ has: page.getByRole('heading', { name: 'Safety', exact: true }) })
  await card.getByRole('button', { name: /Improve with RAG/ }).click()

  await expect(page.locator('#quick-add-Safety')).toHaveValue(/The response time was measured at 2 ms/)
  await expect(page.getByText(/Feedback expanded with/)).toContainText('lexical')
  expect(chatRequests).toHaveLength(1)
  expect(JSON.stringify(chatRequests[0].messages)).toContain('Measured response time: 2 ms.')
})
