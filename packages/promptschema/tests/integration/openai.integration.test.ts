import { describe, expect } from 'vitest'
import { skipIfNoEnv, createTestPrompt, MAX_TOKENS } from './helpers.js'
import { LLMSchemaRunError } from '../../src/index.js'

const test = skipIfNoEnv('OPENAI_API_KEY')
const prompt = createTestPrompt('openai/gpt-4o-mini')

describe('OpenAI adapter (real API)', () => {
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
    expect(result.usage.totalTokens).toBe(
      result.usage.promptTokens + result.usage.completionTokens,
    )
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

  test('respects temperature and maxTokens options', async () => {
    const result = await prompt.run(
      { message: 'Say hello in one word' },
      { temperature: 0, maxTokens: 10 },
    )
    expect(result.text).toBeTruthy()
  })

  test('throws LLMSchemaRunError with invalid API key', async () => {
    await expect(
      prompt.run(
        { message: 'Say hello' },
        { apiKey: 'sk-invalid-key-for-testing', maxTokens: 10 },
      ),
    ).rejects.toThrow(LLMSchemaRunError)
  })
})
