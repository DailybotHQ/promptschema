import { describe, expect, it, beforeAll } from 'vitest'
import { createTestPrompt, MAX_TOKENS } from './helpers.js'
import { LLMSchemaRunError } from '../../src/index.js'

let ollamaAvailable = false
let ollamaModel = 'llama3'

async function checkOllama(): Promise<boolean> {
  try {
    const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
    const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) return false
    const data = (await res.json()) as { models?: Array<{ name: string }> }
    if (data.models && data.models.length > 0) {
      ollamaModel = data.models[0].name.split(':')[0]
      return true
    }
    return false
  } catch {
    return false
  }
}

beforeAll(async () => {
  ollamaAvailable = await checkOllama()
})

function ollamaTest(name: string, fn: () => Promise<void>) {
  it(name, async () => {
    if (!ollamaAvailable) {
      return it.skip
    }
    await fn()
  })
}

describe('Ollama adapter (local server)', () => {
  ollamaTest('executes a simple prompt and returns non-empty text', async () => {
    const prompt = createTestPrompt(`ollama/${ollamaModel}`)
    const result = await prompt.run(
      { message: 'Say hello in one word' },
      { maxTokens: MAX_TOKENS },
    )
    expect(result.text).toBeTruthy()
    expect(result.text.length).toBeGreaterThan(0)
  })

  ollamaTest('returns valid token usage', async () => {
    const prompt = createTestPrompt(`ollama/${ollamaModel}`)
    const result = await prompt.run(
      { message: 'Say hello in one word' },
      { maxTokens: MAX_TOKENS },
    )
    expect(result.usage.promptTokens).toBeGreaterThan(0)
    expect(result.usage.completionTokens).toBeGreaterThan(0)
  })

  ollamaTest('estimated cost is 0 (local model)', async () => {
    const prompt = createTestPrompt(`ollama/${ollamaModel}`)
    const result = await prompt.run(
      { message: 'Say hello in one word' },
      { maxTokens: MAX_TOKENS },
    )
    expect(result.usage.estimatedCost).toBe(0)
  })

  ollamaTest('tracks latency in milliseconds', async () => {
    const prompt = createTestPrompt(`ollama/${ollamaModel}`)
    const result = await prompt.run(
      { message: 'Say hello in one word' },
      { maxTokens: MAX_TOKENS },
    )
    expect(result.latencyMs).toBeGreaterThan(0)
  })

  it('throws LLMSchemaRunError when Ollama is not reachable', async () => {
    const prompt = createTestPrompt('ollama/nonexistent')
    await expect(
      prompt.run(
        { message: 'Say hello' },
        { baseUrl: 'http://localhost:59999', maxTokens: 10 },
      ),
    ).rejects.toThrow(LLMSchemaRunError)
  })
})
