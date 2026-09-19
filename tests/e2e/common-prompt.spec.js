import { test, expect } from '@playwright/test'

test('common prompt stays local while typing and saves on blur without crossing assessments', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    if (!localStorage.getItem('prompt-qa-seeded')) {
      localStorage.setItem('feedback-subjects', JSON.stringify({
        subjects: [{ id: 's', name: 'Prompt QA', assessments: ['A', 'B'].map(id => ({
          id, name: `Assessment ${id}`, totalMarks: 20, topics: [], knowledgeAreas: [],
          categories: [{ id: 'c', name: 'Evidence', allocatedMarks: 20, markingMode: 'percentage' }],
          commonParagraphAiInstructions: `Original ${id}`
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
    await page.getByRole('button', { name: /Common AI Prompt/ }).click()
  }
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('feedback-subjects')).subjects[0].assessments.map(a => a.commonParagraphAiInstructions))
  await page.goto('/')
  await open(0)
  const input = page.locator('#commonParagraphPromptInput')
  await input.fill('')
  await expect(page.getByRole('button', { name: /Common AI Prompt/ }).locator('.badge')).toHaveText('Set')
  await input.fill('Original A')
  await page.evaluate(() => { window.promptWork = { writes: 0, serializations: 0 } })
  await input.press('End')
  await input.pressSequentially(' edited prompt')
  await expect(input).toHaveValue('Original A edited prompt')
  await expect(input).toBeFocused()
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
  await input.fill('')
  await page.getByRole('button', { name: /Common AI Prompt/ }).click()
  await expect.poll(saved).toEqual(['', 'Original B'])
  await page.reload()
  await open(1)
  await expect(input).toHaveValue('Original B')
  await input.fill('Updated B')
  await page.locator('.app-sidebar-column').getByRole('button', { name: /Back to Assessments/ }).click()
  await expect.poll(saved).toEqual(['', 'Updated B'])
  await page.reload()
  await open(0)
  await expect(input).toHaveValue('')
  const longPrompt = 'Use the rubric and cite supporting evidence.\n'.repeat(1200)
  await input.fill(longPrompt)
  await input.press('End')
  await input.pressSequentially('Final instruction.')
  await expect(input).toHaveValue(longPrompt + 'Final instruction.')
  expect(await saved()).toEqual(['', 'Updated B'])
  await input.press('Tab')
  await expect.poll(saved).toEqual([longPrompt + 'Final instruction.', 'Updated B'])
  expect(errors).toEqual([])
})
