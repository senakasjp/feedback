import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const captureDirectory = '/tmp/feedback-consistency-qa'

for (const theme of ['light', 'dark']) {
  for (const width of [375, 768, 1280]) {
    test(`UI consistency ${theme} ${width}`, async ({ page }) => {
      test.setTimeout(90000)
      page.setDefaultTimeout(10000)
      await mkdir(captureDirectory, { recursive: true })
      await page.setViewportSize({ width, height: 900 })
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.route('https://**/*', route => route.request().url().startsWith('https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/') ? route.continue() : route.abort())
      await page.addInitScript(theme => {
        localStorage.clear()
        localStorage.setItem('darkMode', String(theme === 'dark'))
        localStorage.setItem('feedback-navigation-state-v1', JSON.stringify({ view: 'subjects' }))
        localStorage.setItem('feedback-subjects', JSON.stringify({
          subjects: [{ id: 's', name: 'Design Studio QA', assessments: [{
            id: 'a', name: 'Research and Communication', topics: [], knowledgeAreas: [],
            categories: [{ id: 'c', name: 'Evidence and Analysis', allocatedMarks: 20, markingMode: 'percentage' }],
            percentageRanges: [], totalMarks: 20, markingMode: 'percentage'
          }] }],
          students: [{ id: 'qa-student', name: 'Synthetic Student', displayName: 'Synthetic Student', studentId: 'QA-001' }],
          percentageRanges: []
        }))
        localStorage.setItem('feedback-assessment-s-a', JSON.stringify({
          paragraphs: [{ id: 'p', text: 'Evidence and Analysis: Clear supporting evidence.', color: 'green', _source: 'assignment' }],
          selectedParagraphs: [], categoryMarks: {}
        }))
        localStorage.setItem('student-evaluation-qa-student-a', JSON.stringify({
          categoryMarks: { 'Evidence and Analysis': 16 }, paragraphs: []
        }))
      }, theme)
      const capture = async label => {
        await page.screenshot({ path: `${captureDirectory}/${theme}-${width}-${label}.png`, fullPage: true })
        const overflow = await page.evaluate(() => ({
          viewport: innerWidth, document: document.documentElement.scrollWidth,
          controls: [...document.querySelectorAll('button, input, select, textarea')]
            .filter(el => el.getClientRects().length && !el.closest('[hidden], .table-responsive'))
            .filter(el => { const r = el.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1 })
            .map(el => el.getAttribute('aria-label') || el.textContent.trim() || el.id)
        }))
        expect.soft(overflow.document, `${label}: document width`).toBeLessThanOrEqual(overflow.viewport + 1)
        expect.soft(overflow.controls, `${label}: controls outside viewport`).toEqual([])
      }
      let primaryStyle
      const buttonStyle = element => {
        const style = getComputedStyle(element)
        return { background: style.backgroundColor, color: style.color, radius: style.borderRadius, font: style.fontFamily }
      }
      const modal = async (opener, label) => {
        await opener.click()
        const dialog = page.locator('.modal.show').last()
        await expect(dialog).toBeVisible()
        const primary = dialog.locator('.btn-primary:visible').first()
        if (await primary.count()) expect.soft(await primary.evaluate(buttonStyle), `${label}: shared primary style`).toEqual(primaryStyle)
        await capture(label)
        await dialog.locator('.btn-close').first().click()
        await expect(dialog).not.toBeVisible()
      }
      await page.goto('/')
      await expect(page.getByRole('heading', { name: 'Subjects', exact: true, level: 1 })).toBeVisible()
      if (theme === 'dark') await page.getByRole('button', { name: 'Switch to Dark Mode', exact: true }).click()
      await expect(page.locator('html')).toHaveAttribute('data-bs-theme', theme)
      primaryStyle = await page.locator('.app-workspace .btn-primary:visible').first().evaluate(buttonStyle)
      await capture('subjects')
      await page.getByRole('button', { name: /Add Subject|New Subject/ }).first().click()
      await capture('add-subject')
      await page.getByRole('button', { name: 'Open AI model settings', exact: true }).click()
      await capture('ai-settings')
      await page.getByRole('button', { name: 'Open AI model settings', exact: true }).click()
      await modal(page.getByRole('button', { name: 'Open application log', exact: true }), 'application-log')
      await modal(page.getByRole('button', { name: 'About Feedback Manager', exact: true }), 'about')
      await page.getByRole('button', { name: 'Open help page', exact: true }).click()
      await capture('help')
      await page.goto('/')
      if (theme === 'dark') await page.getByRole('button', { name: 'Switch to Dark Mode', exact: true }).click()
      await page.getByRole('button', { name: 'Open subject Design Studio QA', exact: true }).click()
      await capture('assessments')
      await expect(page.locator('.table-responsive').first()).toBeVisible()
      await expect(page.locator('.table-responsive').first()).toContainText('Synthetic Student')
      await page.locator('.table-responsive').first().scrollIntoViewIfNeeded()
      await capture('assessment-marks')
      for (const title of ['Generate and download PDF marks report', 'Export marks to CSV for Excel']) {
        const contrast = await page.getByTitle(title, { exact: true }).evaluate(element => {
          const luminance = rgb => {
            const channels = rgb.map(value => {
              const channel = value / 255
              return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
            })
            return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
          }
          const parseColor = color => color.match(/[\d.]+/g).map(Number)
          const ancestors = []
          for (let node = element; node; node = node.parentElement) ancestors.unshift(node)
          const backgroundRgb = ancestors.reduce((background, node) => {
            const [red, green, blue, alpha = 1] = parseColor(getComputedStyle(node).backgroundColor)
            return [red, green, blue].map((channel, index) => channel * alpha + background[index] * (1 - alpha))
          }, [255, 255, 255])
          const foreground = luminance(parseColor(getComputedStyle(element).color).slice(0, 3))
          const background = luminance(backgroundRgb)
          return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05)
        })
        expect(contrast, `${title}: text contrast`).toBeGreaterThanOrEqual(4.5)
      }
      await page.getByRole('button', { name: /Add Assessment/ }).first().click()
      await capture('add-assessment')
      await page.getByRole('button', { name: /Open Feedback/ }).click()
      await capture('enter-data')
      const instructionButtonBounds = await page.getByTitle('Expand instructions', { exact: true }).first().evaluate(element => {
        const button = element.getBoundingClientRect()
        const card = element.closest('.card').getBoundingClientRect()
        return { left: button.left - card.left, right: card.right - button.right }
      })
      expect(instructionButtonBounds.left).toBeGreaterThanOrEqual(0)
      expect(instructionButtonBounds.right).toBeGreaterThanOrEqual(0)
      await modal(page.getByRole('button', { name: 'Add new student', exact: true }).first(), 'add-student')
      await modal(page.getByRole('button', { name: 'Manage students', exact: true }).first(), 'manage-students')
      await page.locator('.feedback-tab-bar').getByRole('button', { name: /Settings/ }).click()
      await capture('settings')
      if (width === 375) expect(await page.locator('.ui-composer textarea').evaluate(element => element.getBoundingClientRect().width)).toBeGreaterThanOrEqual(150)
      await modal(page.getByRole('button', { name: 'Edit category marking mode', exact: true }).first(), 'category-edit')
      await modal(page.getByTitle('Import paragraphs from other assignments', { exact: true }), 'import')
      const exportButton = page.getByRole('button', { name: /Export Assignment Settings/ })
      if (!(await exportButton.isVisible())) await page.getByRole('button', { name: /Show.*Navigation|Navigation/i }).first().click()
      await modal(exportButton, 'export')
    })
  }
}
