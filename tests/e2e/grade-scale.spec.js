import { test, expect } from '@playwright/test'

const grades = [[95, 'A+'], [87, 'A'], [82, 'A-'], [77, 'B+'], [72, 'B'], [67, 'B-'], [62, 'C+'], [57, 'C'], [52, 'C-'], [45, 'D'], [35, 'F']]

test('summary and CSV use the requested plus/minus grade scale', async ({ page }) => {
  await page.addInitScript(grades => {
    localStorage.clear()
    localStorage.setItem('feedback-subjects', JSON.stringify({ subjects: [{ id: 's', name: 'Grade QA', assessments: [{ id: 'a', name: 'Assessment', weight: 100, totalMarks: 100, categories: [{ name: 'Criterion', allocatedMarks: 100 }] }] }], students: grades.map(([score]) => ({ id: `s${score}`, name: `Synthetic ${score}`, studentId: `QA-${score}` })) }))
    for (const [score] of grades) localStorage.setItem(`student-evaluation-s${score}-a`, JSON.stringify({ categoryMarks: { Criterion: score } }))
    localStorage.setItem('feedback-navigation-state-v1', JSON.stringify({ view: 'subjects' }))
  }, grades)
  await page.goto('/')
  await page.getByRole('button', { name: 'Open subject Grade QA', exact: true }).click()
  for (const [score, grade] of grades) {
    const row = page.getByRole('row').filter({ hasText: `Synthetic ${score}` })
    await expect(row.getByRole('cell').last()).toHaveText(grade)
  }
  await page.getByRole('row').filter({ hasText: 'Synthetic 95' }).locator('..').screenshot({ path: '/tmp/grade-scale.png' })
  await page.getByRole('button', { name: /Export CSV/ }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.locator('.modal.show').getByRole('button', { name: /Export CSV/ }).click()
  const stream = await (await downloadPromise).createReadStream()
  let csv = ''
  for await (const chunk of stream) csv += chunk.toString()
  for (const [score, grade] of grades) expect(csv.split('\n').find(line => line.includes(`Synthetic ${score}`))).toContain(grade)
})
