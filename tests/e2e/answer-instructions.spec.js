import { test, expect } from '@playwright/test'

test('answer instructions stay local while typing and save once on blur', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    if (!localStorage.getItem('prompt-qa-seeded')) {
      localStorage.setItem('feedback-subjects', JSON.stringify({
        subjects: [{ id: 's', name: 'Prompt QA', assessments: ['A', 'B'].map(id => ({
          id, name: `Assessment ${id}`, totalMarks: 20, topics: [], knowledgeAreas: [],
          categories: [{ id: 'c', name: 'Evidence', allocatedMarks: 20, markingMode: 'percentage' }],
          aiAnswerInstructionsByCategory: { Evidence: `Original ${id}` }
        })) }], students: [], percentageRanges: []
      }))
      localStorage.setItem('prompt-qa-seeded', 'true')
    }
    localStorage.setItem('feedback-navigation-state-v1', JSON.stringify({ view: 'subjects' }))
    window.promptWork = { writes: 0, serializations: 0 }
    const stringify = JSON.stringify
    JSON.stringify = function(value, ...args) {
      if (value?.commonParagraphAiInstructions !== undefined || value?.subjects) window.promptWork.serializations++
      return stringify.call(this, value, ...args)
    }
    const setItem = Storage.prototype.setItem
    Storage.prototype.setItem = function(key, value) {
      if (key === 'feedback-subjects') window.promptWork.writes++
      return setItem.call(this, key, value)
    }
  })
  const open = async index => {
    await page.getByRole('button', { name: 'Open subject Prompt QA', exact: true }).click()
    await page.getByRole('button', { name: /Open Feedback/ }).nth(index).click()
    await page.getByTitle('Expand instructions', { exact: true }).click()
  }
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('feedback-subjects')).subjects[0].assessments.map(a => a.aiAnswerInstructionsByCategory.Evidence))
  await page.goto('/')
  await open(0)
  const input = page.locator('#quick-add-instructions-Evidence')
  await page.evaluate(() => { window.promptWork = { writes: 0, serializations: 0 } })
  await input.press('End')
  await input.pressSequentially(' edited prompt')
  await expect(input).toHaveValue('Original A edited prompt')
  await expect(input).toBeFocused()
  await page.waitForTimeout(700)
  const work = await page.evaluate(() => window.promptWork)
  console.log('Typing work:', work)
  expect(work).toEqual({ writes: 0, serializations: 0 })
  expect(await saved()).toEqual(['Original A', 'Original B'])
  await input.press('Tab')
  await expect.poll(saved).toEqual(['Original A edited prompt', 'Original B'])
  expect(await page.evaluate(() => window.promptWork.writes)).toBe(1)
  await input.focus()
  await input.press('Tab')
  expect(await page.evaluate(() => window.promptWork.writes)).toBe(1)
  await page.reload()
  await open(0)
  await expect(input).toHaveValue('Original A edited prompt')
  expect(errors).toEqual([])
})
