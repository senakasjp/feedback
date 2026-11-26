import { test, expect } from '@playwright/test'

// A 100x100 EMF with a solid red rectangle, using standard GDI records.
function rectangleEmf() {
  const bytes = Buffer.alloc(188)
  const write = (offset, value) => bytes.writeUInt32LE(value, offset)
  write(0, 1); write(4, 108)
  write(16, 100); write(20, 100)
  write(32, 2646); write(36, 2646)
  write(40, 0x464d4520); write(44, 0x10000)
  write(48, bytes.length); write(52, 5)
  bytes.writeUInt16LE(2, 56)
  write(72, 100); write(76, 100)
  write(80, 26); write(84, 26)
  write(108, 39); write(112, 24); write(116, 1)
  write(124, 0x000000ff)
  write(132, 37); write(136, 12); write(140, 1)
  write(144, 43); write(148, 24)
  write(152, 10); write(156, 10); write(160, 90); write(164, 90)
  write(168, 14); write(172, 20); write(184, 20)
  return bytes.toString('base64')
}

test('detects EMF bytes with a generic MIME type and preserves attachment metadata', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async emf => {
    const { normalizeAiImage } = await import('/src/services/aiImageContent.js')
    return normalizeAiImage({ type: 'image', mimeType: 'application/octet-stream', data: emf, documentName: 'Synthetic.docx', pageNumber: 2 })
  }, rectangleEmf())
  expect(result).toMatchObject({ type: 'image', mimeType: 'image/png', documentName: 'Synthetic.docx', pageNumber: 2 })
  expect(result.data).toMatch(/^data:image\/png;base64,/)
})

test('rejects a truncated EMF before sending any AI request', async ({ page }) => {
  let requests = 0
  await page.route('https://api.openai.com/**', async route => { requests++; await route.abort() })
  await page.goto('/')
  const emf = Buffer.from(rectangleEmf(), 'base64').subarray(0, 168)
  emf.writeUInt32LE(emf.length, 48)
  const error = await page.evaluate(async emf => {
    const { setStoredApiKey, callChatCompletion } = await import('/src/services/llmProviders.js')
    setStoredApiKey('openai', 'synthetic-key')
    try {
      await callChatCompletion({ providerId: 'openai', model: 'gpt-4o', messages: [{ role: 'user', content: [{ type: 'image', mimeType: 'image/x-emf', data: emf }] }] })
      return ''
    } catch (error) { return error.message }
  }, emf.toString('base64'))
  expect(error).toContain('could not be converted')
  expect(error).toContain('No AI request was sent')
  expect(requests).toBe(0)
})

for (const provider of ['openai', 'anthropic']) {
  test(`RAG converts an embedded EMF to PNG for ${provider}`, async ({ page }) => {
    let body
    await page.route('https://api.openai.com/**', async route => {
      body = route.request().postDataJSON()
      await route.fulfill({ json: { choices: [{ message: { content: 'Checked diagram.' } }] } })
    })
    await page.route('https://api.anthropic.com/**', async route => {
      body = route.request().postDataJSON()
      await route.fulfill({ json: { content: [{ type: 'text', text: 'Checked diagram.' }] } })
    })
    await page.goto('/')
    await page.evaluate(async ({ provider, emf }) => {
      const { setStoredApiKey } = await import('/src/services/llmProviders.js')
      const { improveFeedbackWithRag } = await import('/src/services/aiMarkingService.js')
      setStoredApiKey(provider, 'synthetic-key')
      await improveFeedbackWithRag({
        assessment: { name: 'Synthetic', categories: [] },
        studentSubmission: 'Full text must remain.',
        studentSubmissionDocuments: [{ name: 'Synthetic.docx', images: [{ mimeType: 'image/x-emf', dataUrl: `data:image/x-emf;base64,${emf}` }] }],
        modelPreference: { provider, selectedModel: provider === 'openai' ? 'gpt-4o' : 'claude-sonnet-4-5' }
      })
    }, { provider, emf: rectangleEmf() })
    expect(JSON.stringify(body)).toContain('Full text must remain.')
    const parts = body.messages.flatMap(message => Array.isArray(message.content) ? message.content : [])
    const image = parts.find(part => part.type === 'image_url' || part.type === 'image')
    const url = provider === 'openai' ? image.image_url.url : `data:${image.source.media_type};base64,${image.source.data}`
    expect(url).toMatch(/^data:image\/png;base64,/)
    const pixel = await page.evaluate(async url => {
      const image = new Image()
      image.src = url
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = image.width
      canvas.height = image.height
      const context = canvas.getContext('2d')
      context.drawImage(image, 0, 0)
      return [...context.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data]
    }, url)
    expect(pixel).toEqual([255, 0, 0, 255])
  })
}
