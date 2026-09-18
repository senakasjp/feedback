import { test, expect } from '@playwright/test'

for (const ids of ['unique', 'missing', 'duplicate']) {
  test(`category cards move and persist with ${ids} identifiers`, async ({ page }) => {
    const names = ['Coverage of Knowledge Domains', 'Technical Skills', 'Communication']
    await page.addInitScript(({ names, ids }) => {
      if (localStorage.getItem('order-test-seeded')) return
      const categories = names.map((name, index) => ({ name, allocatedMarks:25, order:index, markingMode:'percentage', ...(ids === 'missing' ? {} : {id:ids === 'duplicate' ? 'same' : `c${index}`}) }))
      localStorage.setItem('feedback-subjects', JSON.stringify({subjects:[{id:'s',name:'Order QA',assessments:[{id:'a',name:'Order assessment',categories,topics:[],knowledgeAreas:[],percentageRanges:[],totalMarks:75}]}],students:[],percentageRanges:[]}))
      localStorage.setItem('feedback-navigation-state-v1',JSON.stringify({view:'subjects'}))
      localStorage.setItem('order-test-seeded','true')
    }, {names,ids})
    await page.goto('/')
    const open = async () => {
      await page.getByRole('button',{name:'Open subject Order QA',exact:true}).click()
      await page.getByRole('button',{name:/Open Feedback/}).click()
    }
    await open()
    const headings = page.locator('.card.border-start h6')
    await expect(headings).toHaveText(names)
    await page.getByRole('button',{name:'Move category down',exact:true}).first().click()
    await expect(headings).toHaveText([names[1],names[0],names[2]])
    await page.getByRole('button',{name:'Move category up',exact:true}).nth(2).click()
    await expect(headings).toHaveText([names[1],names[2],names[0]])
    await page.locator('.feedback-tab-bar').getByRole('button',{name:/Settings/}).click()
    await expect(page.getByLabel('Select Category:').locator('option')).toHaveText(['Choose a category...', names[1],names[2],names[0]])
    await page.reload()
    await open()
    await expect(headings).toHaveText([names[1],names[2],names[0]])
  })
}
