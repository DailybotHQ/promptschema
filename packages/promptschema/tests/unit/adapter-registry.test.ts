import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../../src/adapters/openai.js', () => ({}))
vi.mock('../../src/adapters/anthropic.js', () => ({}))
vi.mock('../../src/adapters/gemini.js', () => ({}))
vi.mock('../../src/adapters/ollama.js', () => ({}))

import { registerAdapter, resolveAdapter, requireEnvVar } from '../../src/adapters/adapter-registry.js'
import { LLMSchemaRunError } from '../../src/errors.js'
import type { LLMAdapter } from '../../src/types.js'

function mockAdapter(name: string): LLMAdapter {
  return {
    name,
    call: vi.fn().mockResolvedValue({
      text: 'mocked',
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
      estimatedCost: 0,
    }),
  }
}

describe('registerAdapter', () => {
  it('registers and resolves a custom adapter', () => {
    const adapter = mockAdapter('custom')
    registerAdapter('custom', adapter)
    const result = resolveAdapter('custom/my-model', 'test-prompt')
    expect(result.adapter).toBe(adapter)
    expect(result.modelName).toBe('my-model')
  })

  it('throws on empty provider name', () => {
    expect(() => registerAdapter('', mockAdapter('bad'))).toThrow(LLMSchemaRunError)
  })
})

describe('resolveAdapter', () => {
  it('throws for model without provider/ prefix', () => {
    expect(() => resolveAdapter('gpt-4o', 'test-prompt')).toThrow(LLMSchemaRunError)
    expect(() => resolveAdapter('gpt-4o', 'test-prompt')).toThrow(/expected "provider\/model"/)
  })

  it('throws for unknown provider', () => {
    expect(() => resolveAdapter('mystery/model', 'test-prompt')).toThrow(LLMSchemaRunError)
    expect(() => resolveAdapter('mystery/model', 'test-prompt')).toThrow(/unknown provider "mystery"/)
  })
})

describe('requireEnvVar', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  it('returns the value if set', () => {
    process.env.MY_KEY = 'secret123'
    expect(requireEnvVar('MY_KEY', 'p', 'm')).toBe('secret123')
  })

  it('throws if env var is missing', () => {
    delete process.env.MY_KEY
    expect(() => requireEnvVar('MY_KEY', 'test-prompt', 'openai/gpt-4o')).toThrow(LLMSchemaRunError)
    expect(() => requireEnvVar('MY_KEY', 'test-prompt', 'openai/gpt-4o')).toThrow(/MY_KEY/)
  })
})
