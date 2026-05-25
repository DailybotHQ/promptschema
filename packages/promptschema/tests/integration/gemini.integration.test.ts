import { describe, expect } from 'vitest'
import { skipIfNoEnv, createTestPrompt, MAX_TOKENS } from './helpers.js'
import { LLMSchemaRunError } from '../../src/index.js'

const hasKey = !!process.env.GEMINI_API_KEY || !!process.env.GOOGLE_API_KEY
const test = hasKey ? (await import('vitest')).it : (await import('vitest')).it.skip
const prompt = createTestPrompt('gemini/gemini-2.0-flash-lite')

describe('Gemini adapter (real API)', () => {
  test('executes a simple prompt and returns non-empty text', async () => {
    const result = await prompt.run(
      { message: 'Say hello in one word' },
      { maxTokens: MAX_TOKENS },
    )
    expect(result.text).toBeTruthy()
    expect(result.text.length).toBeGreaterThan(0)
  })

  test('returns valid token usage', async () => {
    const result = await prompt.run(
      { message: 'Say hello in one word' },
      { maxTokens: MAX_TOKENS },
    )
    expect(result.usage.promptTokens).toBeGreaterThan(0)
    expect(result.usage.completionTokens).toBeGreaterThan(0)
  })

  test('returns estimated cost greater than 0', async () => {
    const result = await prompt.run(
      { message: 'Say hello in one word' },
      { maxTokens: MAX_TOKENS },
    )
    expect(result.usage.estimatedCost).toBeGreaterThan(0)
  })

  test('tracks latency in milliseconds', async () => {
    const result = await prompt.run(
      { message: 'Say hello in one word' },
      { maxTokens: MAX_TOKENS },
    )
    expect(result.latencyMs).toBeGreaterThan(0)
    expect(result.latencyMs).toBeLessThan(30_000)
  })

  test('throws LLMSchemaRunError with invalid API key', async () => {
    await expect(
      prompt.run(
        { message: 'Say hello' },
        { apiKey: 'invalid-gemini-key-for-testing', maxTokens: 10 },
      ),
    ).rejects.toThrow(LLMSchemaRunError)
  })
})
