import { test, expect } from '@playwright/test'

test('AI marking and PDF use the rubric maximum while retaining the configured fallback', async ({ page }) => {
  const requests = []
  await page.route('https://api.openai.com/**', async route => {
    requests.push(route.request().postDataJSON())
    await route.fulfill({ json: { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({
      criteria: [{ criterion_name: 'Project', awarded_mark: 23, judgement: 'The submission demonstrates the criterion.', evidence: ['A working prototype is described.'], improvement_advice: 'Add testing evidence.', suggested_feedback: 'Strong implementation with limited testing evidence.' }],
      overall_feedback: 'The project meets the criterion.'
    }) } }] } })
  })
  await page.addInitScript(() => {
    localStorage.clear()
    const rubricHtml = '<table><tr><th>Criterion</th><th>Excellent</th><th>Needs improvement</th><th>Marks</th></tr><tr><td>Project</td><td>Strong implementation.</td><td>No implementation.</td><td>25</td></tr><tr><td>Total</td><td></td><td></td><td>25</td></tr></table>'
    localStorage.setItem('feedback-ai-apikey-openai', 'synthetic-test-key')
    localStorage.setItem('feedback-subjects', JSON.stringify({ subjects: [{ id: 's', name: 'Rubric Maximum QA', assessments: [{
      id: 'a', name: 'Project rubric', totalMarks: 25, rubricHtml, markingMode: 'percentage', tableRowCategoryMap: { total: 'Project' },
      categories: [{ id: 'project', name: 'Project', allocatedMarks: 10, markingMode: 'percentage' }], topics: [], knowledgeAreas: [],
      percentageRanges: [{ color: 'red', lowerPercentage: 0, upperPercentage: 80 }, { color: 'green', lowerPercentage: 80, upperPercentage: 100 }]
    }] }], students: [{ id: 'student', name: 'Synthetic Student', displayName: 'Synthetic Student' }], percentageRanges: [] }))
    localStorage.setItem('feedback-assessment-s-a', JSON.stringify({ rubricHtml, paragraphs: [
      { id: 'green', text: 'Project: Strong implementation.', color: 'green', _source: 'assignment' },
      { id: 'red', text: 'Project: No implementation.', color: 'red', _source: 'assignment' }
    ], selectedParagraphs: [], categoryMarks: {} }))
    localStorage.setItem('feedback-navigation-state-v1', JSON.stringify({ view: 'subjects' }))
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Open subject Rubric Maximum QA', exact: true }).click()
  await page.getByRole('button', { name: /Open Feedback/ }).click()
  await expect(page.getByText('Check allocation: category maxima do not match the assessment total.', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Student:', exact: true }).click()
  await page.getByRole('button', { name: /Synthetic Student/ }).click()
  await page.getByRole('textbox', { name: 'Student Submission or Evidence Notes Input' }).fill('A working prototype is described. END OF SUBMISSION')
  await page.getByRole('button', { name: 'Assign marks for Project', exact: true }).click()
  await expect(page.getByRole('spinbutton', { name: 'Marks for Project', exact: true })).toHaveValue('23')
  await expect(page.locator('.paragraph-item').filter({ hasText: 'Strong implementation.' }).getByRole('checkbox')).toBeChecked()
  await expect(page.locator('.paragraph-item').filter({ hasText: 'No implementation.' }).getByRole('checkbox')).not.toBeChecked()
  expect(requests).toHaveLength(1)
  const prompt = requests[0].messages.filter(message => message.role === 'user').at(-1).content
  const criteria = JSON.parse(prompt.split('Criteria:\n')[1].split('Student submission or answer:')[0].trim())
  expect(criteria[0].max_mark).toBe(25)
  expect(prompt).toContain('END OF SUBMISSION')

  await page.evaluate(() => {
    window.rubricMaximumReport = null
    const observer = new MutationObserver(() => {
      const table = document.querySelector('.pdf-assessment-html table')
      if (!table) return
      window.rubricMaximumReport = [...table.rows].map(row => [...row.cells].map(cell => cell.textContent))
      observer.disconnect()
    })
    observer.observe(document.body, { childList: true })
  })
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: /Print to Download/ }).click()
  const download = await downloaded
  expect(await download.failure()).toBeNull()
  expect(await page.evaluate(() => window.rubricMaximumReport.find(row => row[0] === 'Project').at(-1))).toBe('23 / 25')
  expect(await page.evaluate(() => window.rubricMaximumReport.find(row => row[0] === 'Total').at(-1))).toBe('25')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('feedback-subjects')).subjects[0].assessments[0].categories[0].allocatedMarks)).toBe(10)
})
