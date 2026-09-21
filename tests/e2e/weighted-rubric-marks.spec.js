import { test, expect } from '@playwright/test'

for (const weight of [60, '60']) {
  test(`weighted summary uses rubric maxima with weight ${typeof weight}`, async ({ page }) => {
    await page.addInitScript(weight => {
      localStorage.clear()
      localStorage.setItem('feedback-subjects', JSON.stringify({
        subjects: [{ id: 's', name: 'Weighted QA', assessments: [
          { id: 'a', name: 'Case Study', weight: 40, totalMarks: 100, categories: [{ id: 'c', name: 'Analysis', allocatedMarks: 100 }] },
          { id: 'b', name: 'Project', weight, totalMarks: 100, categories: [{ id: 'p', name: 'Design' }, { id: 't', name: 'Testing' }], rubricHtml: '<table><tr><th>Criterion</th><th>Marks</th></tr><tr><td>Design</td><td>60</td></tr><tr><td>Testing</td><td>40</td></tr></table>' }
        ] }], students: [{ id: 'student', name: 'Synthetic Student', studentId: 'QA-1' }]
      }))
      localStorage.setItem('student-evaluation-student-a', JSON.stringify({ categoryMarks: { Analysis: 80 } }))
      localStorage.setItem('student-evaluation-student-b', JSON.stringify({ categoryMarks: { Design: 55, Testing: 35 } }))
      localStorage.setItem('feedback-navigation-state-v1', JSON.stringify({ view: 'subjects' }))
    }, weight)
    await page.goto('/')
    await page.getByRole('button', { name: 'Open subject Weighted QA', exact: true }).click()
    const row = page.getByRole('row').filter({ hasText: 'Synthetic Student' })
    await expect(row).toContainText('54.0')
    await expect(row).toContainText('86.0')
    await expect(row.getByRole('cell').last()).toHaveText('A')
    await row.screenshot({ path: `/tmp/weighted-rubric-${typeof weight}.png` })
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: /Export CSV/ }).click()
    await page.locator('.modal.show').getByRole('button', { name: /Export CSV/ }).click()
    const download = await downloadPromise
    const stream = await download.createReadStream()
    let csv = ''
    for await (const chunk of stream) csv += chunk.toString()
    expect(csv).toContain('54.0')
    expect(csv).toContain('86.0')
  })
}

test('rubric maxima preserve incomplete and invalid mark checks without changing saved allocations', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const { getAssessmentForMarking } = await import('/src/utils/rubricMarks.js')
    const { getMarkSummary } = await import('/src/utils/markingRules.js')
    const assessment = { totalMarks: 100, categories: [{ name: 'Design', allocatedMarks: 60 }, { name: 'Testing', allocatedMarks: 60 }], rubricHtml: '<table><tr><th>Criterion</th><th>Marks</th></tr><tr><td>Design</td><td>50</td></tr><tr><td>Testing</td><td>50</td></tr></table>' }
    const original = JSON.stringify(assessment)
    const resolved = getAssessmentForMarking(assessment)
    return {
      complete: getMarkSummary(resolved, { Design: 45, Testing: 45 }).percentage,
      missing: getMarkSummary(resolved, { Design: 45 }).isComplete,
      invalid: getMarkSummary(resolved, { Design: 55, Testing: 35 }).isComplete,
      mismatch: getMarkSummary({ ...resolved, totalMarks: 110 }, { Design: 45, Testing: 45 }).isComplete,
      unchanged: JSON.stringify(assessment) === original
    }
  })
  expect(result).toEqual({ complete: 90, missing: false, invalid: false, mismatch: false, unchanged: true })
})
