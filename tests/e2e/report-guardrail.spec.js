import { test, expect } from '@playwright/test'

async function openFeedback(page, paragraphs, selectedIds, assessmentOverrides = {}) {
  await page.addInitScript(({ paragraphs, selectedIds, assessmentOverrides }) => {
    localStorage.clear()
    const assessment = {
      id: 'a',
      name: 'Guardrail assessment',
      totalMarks: 10,
      categories: [{ id: 'c1', name: 'Analysis', allocatedMarks: 10, markingMode: 'percentage' }],
      topics: [],
      knowledgeAreas: []
    }
    localStorage.setItem('feedback-subjects', JSON.stringify({
      subjects: [{ id: 's', name: 'Guardrail QA', assessments: [assessment] }],
      students: [{ id: 'student', name: 'Synthetic Student', displayName: 'Synthetic Student' }],
      percentageRanges: []
    }))
    localStorage.setItem('feedback-assessment-s-a', JSON.stringify({
      paragraphs,
      selectedParagraphs: selectedIds,
      categoryMarks: { Analysis: 5 }
    }))
    localStorage.setItem('feedback-navigation-state-v1', JSON.stringify({ view: 'subjects' }))
  }, { paragraphs, selectedIds, assessmentOverrides })
  await page.goto('/')
  await page.getByRole('button', { name: 'Open subject Guardrail QA', exact: true }).click()
  await page.getByRole('button', { name: /Open Feedback/ }).click()
  await page.getByRole('button', { name: 'Student:', exact: true }).click()
  await page.getByRole('button', { name: /Synthetic Student/ }).click()
}

const flaggedParagraph = {
  id: 'p1',
  text: 'Analysis: Assessor should check this before finalising the mark.',
  color: 'green',
  _source: 'assignment'
}
const cleanParagraph = {
  id: 'p2',
  text: 'Analysis: You compared two cloud platforms and measured their monthly cost.',
  color: 'green',
  _source: 'assignment'
}

async function selectParagraph(page, text) {
  await page.locator('.paragraph-item').filter({ hasText: text }).getByRole('checkbox').check()
}

test('blocks the download and names the paragraph that reads as a note to the assessor', async ({ page }) => {
  await openFeedback(page, [flaggedParagraph, cleanParagraph], ['p1'])
  await selectParagraph(page, 'Assessor should check this before finalising the mark.')

  let downloadStarted = false
  page.on('download', () => { downloadStarted = true })

  await page.getByRole('button', { name: /Print to Download/ }).click()

  const dialog = page.getByRole('dialog', { name: /Guardrail failed/ })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Paragraph 1')
  await expect(dialog).toContainText('Analysis')
  await expect(dialog).toContainText('Instruction to the assessor')
  await expect(dialog).toContainText('Assessor should check this')
  await expect(dialog.getByRole('button', { name: /Download PDF/ })).toHaveCount(0)
  await expect(page.locator('.paragraph-item.guardrail-flagged-paragraph')).toContainText('Wording or spelling to fix here')
  expect(downloadStarted).toBe(false)

  await dialog.getByRole('button', { name: /Go back and fix/ }).click()
  await expect(dialog).toHaveCount(0)
})

test('blocks a paragraph with a spelling mistake and shows the suggestion', async ({ page }) => {
  const typoParagraph = {
    id: 'p3',
    text: 'Analysis: You recieve a clear benefit from the automation.',
    color: 'green',
    _source: 'assignment'
  }
  await openFeedback(page, [typoParagraph, cleanParagraph], ['p3'])
  await selectParagraph(page, 'You recieve a clear benefit from the automation.')

  let downloadStarted = false
  page.on('download', () => { downloadStarted = true })

  await page.getByRole('button', { name: /Print to Download/ }).click()

  const dialog = page.getByRole('dialog', { name: /Guardrail failed/ })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Paragraph 1')
  await expect(dialog).toContainText('Spelling')
  await expect(dialog).toContainText('recieve')
  expect(downloadStarted).toBe(false)
})

test('blocks a paragraph with a grammar mistake', async ({ page }) => {
  const grammarParagraph = {
    id: 'p4',
    text: 'Analysis: The second option is more then twice the price.',
    color: 'green',
    _source: 'assignment'
  }
  await openFeedback(page, [grammarParagraph, cleanParagraph], ['p4'])
  await selectParagraph(page, 'The second option is more then twice the price.')

  await page.getByRole('button', { name: /Print to Download/ }).click()

  const dialog = page.getByRole('dialog', { name: /Guardrail failed/ })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Grammar')
  await expect(dialog).toContainText('more then')
})

test('skip ignores one item at a time, then downloads', async ({ page }) => {
  const typoA = {
    id: 'p5',
    text: 'Analysis: You recieve a clear benefit from the automation.',
    color: 'green',
    _source: 'assignment'
  }
  const typoB = {
    id: 'p6',
    text: 'Analysis: The second option is more then twice the price.',
    color: 'green',
    _source: 'assignment'
  }
  await openFeedback(page, [typoA, typoB], ['p5', 'p6'])
  await selectParagraph(page, 'You recieve a clear benefit from the automation.')
  await selectParagraph(page, 'The second option is more then twice the price.')

  let downloads = 0
  page.on('download', () => { downloads += 1 })

  await page.getByRole('button', { name: /Print to Download/ }).click()

  const firstDialog = page.getByRole('dialog', { name: /Guardrail failed/ })
  await expect(firstDialog).toBeVisible()
  await expect(firstDialog).toContainText('Paragraph 1')
  await expect(firstDialog).toContainText('Paragraph 2')
  await expect(firstDialog.getByRole('button', { name: 'Skip' })).toBeVisible()

  await firstDialog.getByRole('button', { name: 'Skip' }).click()

  // One item is skipped, the second still blocks the download.
  const secondDialog = page.getByRole('dialog', { name: /Guardrail failed/ })
  await expect(secondDialog).toBeVisible()
  await expect(secondDialog).toContainText('1 item skipped')
  await expect(secondDialog).not.toContainText('Paragraph 1')
  await expect(secondDialog).toContainText('Paragraph 2')
  expect(downloads).toBe(0)

  const downloaded = page.waitForEvent('download')
  await secondDialog.getByRole('button', { name: 'Skip' }).click()

  const passDialog = page.getByRole('dialog', { name: /Guardrail passed/ })
  await expect(passDialog).toBeVisible()
  await expect(passDialog).toContainText('2 items skipped')

  const download = await downloaded
  expect(await download.failure()).toBeNull()
  expect(downloads).toBe(1)

  await passDialog.getByRole('button', { name: /OK/ }).click()
  await expect(passDialog).toHaveCount(0)
})

test('downloads the feedback report when category maxima do not match Total Marks', async ({ page }) => {
  await openFeedback(page, [cleanParagraph], ['p2'], { totalMarks: 20 })
  await selectParagraph(page, 'You compared two cloud platforms and measured their monthly cost.')

  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: /Print to Download/ }).click()

  const dialog = page.getByRole('dialog', { name: /Guardrail passed/ })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Checked 1 paragraph')

  const download = await downloaded
  expect(await download.failure()).toBeNull()
  await dialog.getByRole('button', { name: /OK/ }).click()
})

test('shows the guardrail pass while the pressed download continues', async ({ page }) => {
  await openFeedback(page, [flaggedParagraph, cleanParagraph], ['p2'])
  await selectParagraph(page, 'You compared two cloud platforms and measured their monthly cost.')

  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: /Print to Download/ }).click()

  const dialog = page.getByRole('dialog', { name: /Guardrail passed/ })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Checked 1 paragraph')
  await expect(dialog.getByRole('button', { name: /Download PDF/ })).toHaveCount(0)

  const download = await downloaded
  expect(await download.failure()).toBeNull()

  await dialog.getByRole('button', { name: /OK/ }).click()
  await expect(dialog).toHaveCount(0)
})
