import { test, expect } from '@playwright/test'

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5VQAAAAASUVORK5CYII='

for (const provider of ['openai', 'anthropic']) {
  test(`normalizes incorrectly labelled PNG bytes for ${provider}`, async ({ page }) => {
    let body
    await page.route('https://api.openai.com/**', async route => { body = route.request().postDataJSON(); await route.fulfill({ json: { choices: [{ message: { content: 'Checked evidence.' } }] } }) })
    await page.route('https://api.anthropic.com/**', async route => { body = route.request().postDataJSON(); await route.fulfill({ json: { content: [{ type: 'text', text: 'Checked evidence.' }] } }) })
    await page.goto('/')
    await page.evaluate(async ({ provider, png }) => {
      const { setStoredApiKey, callChatCompletion } = await import('/src/services/llmProviders.js')
      setStoredApiKey(provider, 'synthetic-key')
      await callChatCompletion({ providerId: provider, model: provider === 'openai' ? 'gpt-4o' : 'claude-sonnet-4-5', messages: [{ role: 'user', content: [{ type: 'image', mimeType: 'application/octet-stream', data: `data:application/octet-stream;base64,${png}` }] }] })
    }, { provider, png })
    const part = body.messages[0].content[0]
    if (provider === 'openai') expect(part.image_url.url).toBe(`data:image/png;base64,${png}`)
    else expect(part.source.media_type).toBe('image/png')
  })
}

test('RAG reports unsupported embedded images before making an AI request', async ({ page }) => {
  let requests = 0
  await page.route('https://api.openai.com/**', async route => { requests++; await route.fulfill({ json: { choices: [{ message: { content: 'Unexpected success.' } }] } }) })
  await page.goto('/')
  const error = await page.evaluate(async () => {
    const { setStoredApiKey } = await import('/src/services/llmProviders.js')
    const { improveFeedbackWithRag } = await import('/src/services/aiMarkingService.js')
    setStoredApiKey('openai', 'synthetic-key')
    try {
      await improveFeedbackWithRag({ assessment: { name: 'Synthetic', categories: [] }, studentSubmission: 'Full text must remain.', studentSubmissionDocuments: [{ name: 'Synthetic.docx', images: [{ mimeType: 'image/x-emf', dataUrl: 'data:image/x-emf;base64,ZW1m' }] }], modelPreference: { provider: 'openai', selectedModel: 'gpt-4o' } })
      return ''
    } catch (error) { return error.message }
  })
  expect(error).toContain('image/x-emf')
  expect(error).toContain('PNG or JPEG')
  expect(requests).toBe(0)
})

test('converts a BMP attachment to PNG without dropping its pixels', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const { normalizeAiImage } = await import('/src/services/aiImageContent.js')
    const bytes = new Uint8Array(58)
    const header = new DataView(bytes.buffer)
    bytes.set([66, 77])
    header.setUint32(2, 58, true)
    header.setUint32(10, 54, true)
    header.setUint32(14, 40, true)
    header.setInt32(18, 1, true)
    header.setInt32(22, 1, true)
    header.setUint16(26, 1, true)
    header.setUint16(28, 24, true)
    header.setUint32(34, 4, true)
    bytes.set([0, 0, 255, 0], 54)
    const normalized = await normalizeAiImage({ type: 'image', mimeType: 'image/bmp', data: `data:image/bmp;base64,${btoa(String.fromCharCode(...bytes))}` })
    const image = new Image()
    image.src = normalized.data
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    const context = canvas.getContext('2d')
    context.drawImage(image, 0, 0)
    return { mimeType: normalized.mimeType, prefix: normalized.data.slice(0, 22), pixel: [...context.getImageData(0, 0, 1, 1).data] }
  })
  expect(result).toEqual({ mimeType: 'image/png', prefix: 'data:image/png;base64,', pixel: [255, 0, 0, 255] })
})
