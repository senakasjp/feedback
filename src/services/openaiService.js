/**
 * OpenAI Service
 * Handles all interactions with the OpenAI API
 */

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'

/**
 * Improve the English grammar and clarity of the given text
 * @param {string} text - The text to improve
 * @returns {Promise<string>} - The improved text
 */
export async function improveEnglish(text) {
  if (!text || text.trim() === '') {
    throw new Error('Text cannot be empty')
  }

  if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your-api-key-here') {
    throw new Error('OpenAI API key is not configured. Please add your API key to the .env file.')
  }

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Using the cost-effective model
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that improves English text for clarity, grammar, and professionalism. IMPORTANT: Use British English spelling and conventions (e.g., "organise" not "organize", "colour" not "color"). Use simple, clear English that is easy to understand - avoid complex or advanced vocabulary. Write like a non-native English speaker would - use common, everyday words instead of sophisticated or academic language. CRITICAL: Preserve all scientific terms, technical vocabulary, domain-specific terminology, and specialist language exactly as written - do not simplify or replace these terms. Only simplify general language around the technical terms. Ensure the text is contextually correct and appropriate for educational feedback. Maintain the original meaning and tone. Only return the improved text without explanations or additional commentary.'
          },
          {
            role: 'user',
            content: `Please improve the following text using British English spelling and simple, easy-to-understand words. Avoid complex vocabulary - use normal, everyday English. IMPORTANT: Keep all scientific terms, technical words, and specialist terminology exactly as they are - do not change or simplify them:\n\n${text}`
          }
        ],
        temperature: 0.3, // Lower temperature for more consistent, focused improvements
        max_tokens: 1000
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || `API request failed with status ${response.status}`)
    }

    const data = await response.json()
    const improvedText = data.choices[0]?.message?.content?.trim()

    if (!improvedText) {
      throw new Error('No response received from OpenAI')
    }

    return improvedText
  } catch (error) {
    console.error('OpenAI API Error:', error)
    throw error
  }
}

/**
 * Check if the OpenAI API is properly configured
 * @returns {boolean} - True if API key is configured
 */
export function isOpenAIConfigured() {
  return OPENAI_API_KEY && OPENAI_API_KEY !== 'your-api-key-here'
}
