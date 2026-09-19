import { test, expect } from '@playwright/test'

async function openMarking(page, awardedMark, delayed = false, fixed = false) {
  let release
  let sent
  const requests = []
  const requestReceived = new Promise(resolve => { sent = resolve })
  const responseGate = new Promise(resolve => { release = resolve })
  await page.route('https://api.openai.com/**', async route => {
    const body = route.request().postDataJSON()
    requests.push(body)
    const userPrompt = body.messages.filter(message => message.role === 'user').at(-1).content
    const criteria = JSON.parse(userPrompt.split('Criteria:\n')[1].split('Student submission or answer:')[0].trim())
    const categoryName = criteria[0].criterion_name
    const mark = typeof awardedMark === 'object' ? awardedMark[categoryName] : awardedMark
    if (typeof delayed !== 'string' || delayed === categoryName) sent(body)
    if (delayed === true || delayed === categoryName) await responseGate
    await route.fulfill({ json: { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({
      criteria: [{ criterion_name: categoryName, awarded_mark: mark, judgement: 'Evidence assessed against the rubric.', evidence: ['Measured response time: 2 ms'], improvement_advice: 'Document measurement limits.', suggested_feedback: 'Measured response time is supported.' }],
      overall_feedback: 'Category assessed.'
    }) } }] } })
  })
  await page.addInitScript(fixed => {
    localStorage.clear()
    localStorage.setItem('feedback-ai-apikey-openai', 'synthetic-test-key')
    localStorage.setItem('feedback-subjects', JSON.stringify({ subjects: [{ id: 's', name: 'Mark QA', assessments: [{
      id: 'a', name: 'Rubric assessment', totalMarks: 20, topics: [], knowledgeAreas: [], markingMode: 'percentage',
      categories: [{ id: 'safety', name: 'Safety', allocatedMarks: 10, description: 'Measure response time and discuss limits', markingMode: fixed ? 'fixed' : 'percentage', colorMarks: { red: 0, green: 8 } }, { id: 'other', name: 'Other', allocatedMarks: 10, markingMode: 'percentage' }],
      rubricHtml: '<table><tr><td>Safety: require measurements and discuss limitations</td></tr></table>',
      percentageRanges: [{ color: 'red', lowerPercentage: 0, upperPercentage: 80 }, { color: 'green', lowerPercentage: 80, upperPercentage: 100 }]
    }] }], students: [{ id: 'student', name: 'Synthetic Student', displayName: 'Synthetic Student' }], percentageRanges: [] }))
    localStorage.setItem('feedback-assessment-s-a', JSON.stringify({ paragraphs: [
      { id: 'red', text: 'Safety: Limited evidence.', color: 'red', _source: 'assignment', ...(fixed ? { markInfo: { type: 'fixed', numericValue: 8, color: 'red' } } : {}) },
      { id: 'green', text: 'Safety: Strong measured evidence.', color: 'green', _source: 'assignment' },
      { id: 'other', text: 'Other: Independent feedback.', color: 'green', _source: 'assignment' },
      { id: 'other-red', text: 'Other: Missing supporting evidence.', color: 'red', _source: 'assignment' }
    ], selectedParagraphs: [], categoryMarks: {} }))
    localStorage.setItem('feedback-navigation-state-v1', JSON.stringify({ view: 'subjects' }))
  }, fixed)
  await page.goto('/')
  await page.getByRole('button', { name: 'Open subject Mark QA', exact: true }).click()
  await page.getByRole('button', { name: /Open Feedback/ }).click()
  await expect(page.getByRole('button', { name: 'Assign marks for Safety', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Student:', exact: true }).click()
  await page.getByRole('button', { name: /Synthetic Student/ }).click()
  await page.getByRole('textbox', { name: 'Student Submission or Evidence Notes Input' }).fill('Measured response time: 2 ms\n' + 'Complete submission evidence. '.repeat(1500) + '\nEND OF FULL SUBMISSION')
  return { release, requestReceived, requests }
}

const paragraphCheckbox = (page, text) => page.locator('.paragraph-item').filter({ hasText: text }).getByRole('checkbox')

for (const mark of [8, 0]) {
  test(`assigns ${mark} using the rubric and selects the configured colour band`, async ({ page }) => {
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    const { requestReceived } = await openMarking(page, mark)
    await paragraphCheckbox(page, 'Independent feedback.').check()
    await page.getByRole('spinbutton', { name: 'Marks for Other', exact: true }).fill('9')
    await paragraphCheckbox(page, mark === 8 ? 'Limited evidence.' : 'Strong measured evidence.').check()
    await page.getByRole('button', { name: 'Assign marks for Safety', exact: true }).click()
    const request = await requestReceived
    const prompt = JSON.stringify(request.messages)
    expect(prompt).toContain('END OF FULL SUBMISSION')
    expect(prompt).toContain('require measurements and discuss limitations')
    await expect(page.getByRole('spinbutton', { name: 'Marks for Safety', exact: true })).toHaveValue(String(mark))
    await expect(paragraphCheckbox(page, mark === 8 ? 'Strong measured evidence.' : 'Limited evidence.')).toBeChecked()
    await expect(paragraphCheckbox(page, mark === 8 ? 'Limited evidence.' : 'Strong measured evidence.')).not.toBeChecked()
    await expect(paragraphCheckbox(page, 'Independent feedback.')).toBeChecked()
    await expect(page.getByRole('spinbutton', { name: 'Marks for Other', exact: true })).toHaveValue('9')
    await page.getByRole('button', { name: 'Why this mark?', exact: true }).click()
    await expect(page.locator('.modal.show')).toContainText('Measured response time: 2 ms')
    await page.locator('.modal.show .btn-close').click()
    await page.screenshot({ path: `/tmp/feedback-assigned-${mark}.png`, fullPage: true })
    const notificationClose = page.getByRole('button', { name: 'Close notification', exact: true })
    if (await notificationClose.isVisible()) await notificationClose.click()
    if (mark === 8) {
      const card = page.locator('.card.border-start').filter({ has: page.getByRole('spinbutton', { name: 'Marks for Safety', exact: true }) })
      for (const theme of ['light', 'dark']) {
        if (theme === 'dark') await page.getByRole('button', { name: 'Switch to Dark Mode', exact: true }).click()
        for (const width of [375, 768, 1280]) {
          await page.setViewportSize({ width, height: 900 })
          await card.locator('.card-header').evaluate(element => element.scrollIntoView({ block: 'center' }))
          const bounds = await card.locator('.card-header').evaluate(element => {
            const header = element.getBoundingClientRect()
            return [...element.querySelectorAll('input, button')].every(control => {
              const r = control.getBoundingClientRect()
              return r.left >= header.left && r.right <= header.right
            })
          })
          expect(bounds).toBe(true)
          await card.locator('.card-header').screenshot({ animations: 'disabled', path: '/tmp/assign-mark-' + theme + '-' + width + '.png' })
        }
      }
    }
    await page.getByRole('button', { name: /Save Student Data/ }).click()
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('student-evaluation-student-a') || '{}').categoryMarks?.Safety)).toBe(mark)
    await page.getByRole('button', { name: 'Student:', exact: true }).click()
    await page.getByRole('button', { name: /Synthetic Student/ }).click()
    await expect(page.getByRole('spinbutton', { name: 'Marks for Safety', exact: true })).toHaveValue(String(mark))
    await expect(paragraphCheckbox(page, mark === 8 ? 'Strong measured evidence.' : 'Limited evidence.')).toBeChecked()
    expect(errors).toEqual([])
  })
}

test('rejects out-of-range AI marks without changing existing marks', async ({ page }) => {
  await openMarking(page, 11)
  const mark = page.getByRole('spinbutton', { name: 'Marks for Safety', exact: true })
  await mark.fill('3')
  await page.getByRole('button', { name: 'Assign marks for Safety', exact: true }).click()
  await expect(page.getByText(/Could not assign marks:/)).toBeVisible()
  await expect(mark).toHaveValue('3')
})

test('does not overwrite manual edits made while an AI mark is pending', async ({ page }) => {
  const { release, requestReceived } = await openMarking(page, 8, true)
  await page.getByRole('button', { name: 'Assign marks for Safety', exact: true }).click()
  await requestReceived
  const mark = page.getByRole('spinbutton', { name: 'Marks for Safety', exact: true })
  await mark.fill('4')
  release()
  await expect(page.getByText(/changed during marking/)).toBeVisible()
  await expect(mark).toHaveValue('4')
})

test('does not apply an old response after leaving the student', async ({ page }) => {
  const { release, requestReceived } = await openMarking(page, 8, true)
  await page.getByRole('button', { name: 'Assign marks for Safety', exact: true }).click()
  await requestReceived
  await page.locator('.app-sidebar-column').getByRole('button', { name: /Back to Assessments/ }).click()
  release()
  await page.getByRole('button', { name: /Open Feedback/ }).click()
  await expect(page.getByRole('spinbutton', { name: 'Marks for Safety', exact: true })).toHaveValue('')
})

test('fixed mode selects the configured colour instead of stale paragraph metadata', async ({ page }) => {
  await openMarking(page, 8, false, true)
  await page.getByRole('button', { name: 'Assign marks for Safety', exact: true }).click()
  await expect(page.getByRole('spinbutton', { name: 'Marks for Safety', exact: true })).toHaveValue('8')
  await expect(paragraphCheckbox(page, 'Strong measured evidence.')).toBeChecked()
  await expect(paragraphCheckbox(page, 'Limited evidence.')).not.toBeChecked()
})

test('assigns all heading marks and colour bands together and replaces existing marks on request', async ({ page }) => {
  const { requests } = await openMarking(page, { Safety: 8, Other: 9 })
  await paragraphCheckbox(page, 'Limited evidence.').check()
  await paragraphCheckbox(page, 'Missing supporting evidence.').check()
  await page.getByRole('spinbutton', { name: 'Marks for Safety', exact: true }).fill('2')
  await page.getByRole('spinbutton', { name: 'Marks for Other', exact: true }).fill('3')
  await page.getByRole('button', { name: 'Assign marks to all headings', exact: true }).click()
  await expect(page.getByRole('spinbutton', { name: 'Marks for Safety', exact: true })).toHaveValue('8')
  await expect(page.getByRole('spinbutton', { name: 'Marks for Other', exact: true })).toHaveValue('9')
  await expect(paragraphCheckbox(page, 'Strong measured evidence.')).toBeChecked()
  await expect(paragraphCheckbox(page, 'Independent feedback.')).toBeChecked()
  await expect(paragraphCheckbox(page, 'Limited evidence.')).not.toBeChecked()
  await expect(paragraphCheckbox(page, 'Missing supporting evidence.')).not.toBeChecked()
  await expect(page.getByRole('button', { name: 'Why this mark?', exact: true })).toHaveCount(2)
  expect(requests).toHaveLength(2)
  for (const request of requests) {
    expect(JSON.stringify(request.messages)).toContain('END OF FULL SUBMISSION')
    expect(JSON.stringify(request.messages)).toContain('require measurements and discuss limitations')
  }
  const notificationClose = page.getByRole('button', { name: 'Close notification', exact: true })
  if (await notificationClose.isVisible()) await notificationClose.click()
  const toolbar = page.getByRole('button', { name: 'Assign marks to all headings', exact: true }).locator('..')
  for (const theme of ['light', 'dark']) {
    if (theme === 'dark') await page.getByRole('button', { name: 'Switch to Dark Mode', exact: true }).click()
    for (const width of [375, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 })
      await toolbar.scrollIntoViewIfNeeded()
      const fits = await toolbar.evaluate(element => {
        const button = element.querySelector('button').getBoundingClientRect()
        return button.left >= 0 && button.right <= window.innerWidth
      })
      expect(fits).toBe(true)
      await toolbar.screenshot({ animations: 'disabled', path: `/tmp/all-headings-${theme}-${width}.png` })
    }
  }
  await page.getByRole('button', { name: /Save Student Data/ }).click()
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('student-evaluation-student-a') || '{}').categoryMarks)).toEqual({ Safety: 8, Other: 9 })
})

test('failed second heading leaves every existing mark and selection unchanged', async ({ page }) => {
  const { requests } = await openMarking(page, { Safety: 8, Other: 11 })
  await paragraphCheckbox(page, 'Limited evidence.').check()
  await paragraphCheckbox(page, 'Missing supporting evidence.').check()
  const safety = page.getByRole('spinbutton', { name: 'Marks for Safety', exact: true })
  const other = page.getByRole('spinbutton', { name: 'Marks for Other', exact: true })
  await safety.fill('2')
  await other.fill('3')
  await page.getByRole('button', { name: 'Assign marks to all headings', exact: true }).click()
  await expect(page.getByText(/Could not assign marks/)).toBeVisible()
  expect(requests).toHaveLength(2)
  await expect(safety).toHaveValue('2')
  await expect(other).toHaveValue('3')
  await expect(paragraphCheckbox(page, 'Limited evidence.')).toBeChecked()
  await expect(paragraphCheckbox(page, 'Missing supporting evidence.')).toBeChecked()
  await expect(paragraphCheckbox(page, 'Strong measured evidence.')).not.toBeChecked()
  await expect(paragraphCheckbox(page, 'Independent feedback.')).not.toBeChecked()
  await expect(page.getByRole('button', { name: 'Why this mark?', exact: true })).toHaveCount(0)
})

test('bulk marking does not overwrite a manual edit while results are pending', async ({ page }) => {
  const { release, requestReceived } = await openMarking(page, { Safety: 8, Other: 9 }, true)
  await page.getByRole('button', { name: 'Assign marks to all headings', exact: true }).click()
  await requestReceived
  const mark = page.getByRole('spinbutton', { name: 'Marks for Other', exact: true })
  await mark.fill('4')
  release()
  await expect(page.getByText(/changed during marking/)).toBeVisible()
  await expect(mark).toHaveValue('4')
  await expect(page.getByRole('spinbutton', { name: 'Marks for Safety', exact: true })).toHaveValue('')
})

test('bulk marking does not apply results after leaving the student', async ({ page }) => {
  const { release, requestReceived } = await openMarking(page, { Safety: 8, Other: 9 }, true)
  await page.getByRole('button', { name: 'Assign marks to all headings', exact: true }).click()
  await requestReceived
  await page.locator('.app-sidebar-column').getByRole('button', { name: /Back to Assessments/ }).click()
  release()
  await page.getByRole('button', { name: /Open Feedback/ }).click()
  await expect(page.getByRole('spinbutton', { name: 'Marks for Safety', exact: true })).toHaveValue('')
  await expect(page.getByRole('spinbutton', { name: 'Marks for Other', exact: true })).toHaveValue('')
})

test('bulk marking rejects results when an unselected matching paragraph was deleted between heading responses', async ({ page }) => {
  const { release, requestReceived, requests } = await openMarking(page, { Safety: 8, Other: 9 }, 'Other')
  await page.getByRole('spinbutton', { name: 'Marks for Safety', exact: true }).fill('2')
  await page.getByRole('spinbutton', { name: 'Marks for Other', exact: true }).fill('3')
  await page.getByRole('button', { name: 'Assign marks to all headings', exact: true }).click()
  await requestReceived
  expect(requests).toHaveLength(2)
  await expect(page.getByRole('spinbutton', { name: 'Marks for Safety', exact: true })).toHaveValue('2')
  await page.locator('.paragraph-item').filter({ hasText: 'Strong measured evidence.' }).getByRole('button', { name: 'Delete paragraph', exact: true }).click()
  await expect(page.locator('.paragraph-item').filter({ hasText: 'Strong measured evidence.' })).toHaveCount(0)
  await expect(page.getByText(/Assessment settings saved\. Paragraph data/)).toBeVisible()
  release()
  await expect(page.getByText(/changed during marking/)).toBeVisible()
  await expect(page.getByRole('spinbutton', { name: 'Marks for Safety', exact: true })).toHaveValue('2')
  await expect(page.getByRole('spinbutton', { name: 'Marks for Other', exact: true })).toHaveValue('3')
  await expect(paragraphCheckbox(page, 'Independent feedback.')).not.toBeChecked()
})
