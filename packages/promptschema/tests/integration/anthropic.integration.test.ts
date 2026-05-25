import { describe, expect } from 'vitest'
import { skipIfNoEnv, createTestPrompt, MAX_TOKENS } from './helpers.js'
import { LLMSchemaRunError } from '../../src/index.js'

const test = skipIfNoEnv('ANTHROPIC_API_KEY')
const prompt = createTestPrompt('anthropic/claude-haiku-3-5')

describe('Anthropic adapter (real API)', () => {
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
    expect(result.usage.totalTokens).toBeGreaterThan(0)
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
        { apiKey: 'sk-ant-invalid-key-for-testing', maxTokens: 10 },
      ),
    ).rejects.toThrow(LLMSchemaRunError)
  })
})
