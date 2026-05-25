import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'
import { runPrompt, type RunPromptConfig } from '../../src/runner.js'
import { registerAdapter } from '../../src/adapters/adapter-registry.js'
import { LLMSchemaValidationError, LLMSchemaRunError } from '../../src/errors.js'
import type { LLMAdapter } from '../../src/types.js'

const mockCall = vi.fn()

const testAdapter: LLMAdapter & { callWithOptions: typeof mockCall } = {
  name: 'test-provider',
  call: mockCall,
  callWithOptions: mockCall,
}

registerAdapter('test-provider', testAdapter)

const config: RunPromptConfig = {
  name: 'greeting-prompt',
  version: '1.0.0',
  model: 'test-provider/test-model',
  input: z.object({ name: z.string() }),
  template: (input: unknown) => `Hello, ${(input as { name: string }).name}!`,
}

describe('runPrompt', () => {
  beforeEach(() => {
    mockCall.mockReset()
    mockCall.mockResolvedValue({
      text: 'Hi back!',
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
      estimatedCost: 0.001,
    })
  })

  it('validates input, renders template, and calls adapter', async () => {
    const result = await runPrompt(config, { name: 'Oscar' })

    expect(result.text).toBe('Hi back!')
    expect(result.usage.promptTokens).toBe(10)
    expect(result.usage.completionTokens).toBe(5)
    expect(result.usage.totalTokens).toBe(15)
    expect(result.model).toBe('test-provider/test-model')
    expect(result.version).toBe('1.0.0')
    expect(result.latencyMs).toBeGreaterThanOrEqual(0)

    expect(mockCall).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'test-model', prompt: 'Hello, Oscar!' }),
      expect.objectContaining({ promptName: 'greeting-prompt' }),
    )
  })

  it('throws LLMSchemaValidationError on invalid input', async () => {
    await expect(runPrompt(config, { name: 123 })).rejects.toThrow(LLMSchemaValidationError)
  })

  it('throws LLMSchemaRunError for unknown provider', async () => {
    const badConfig = { ...config, model: 'nonexistent/model' }
    await expect(runPrompt(badConfig, { name: 'test' })).rejects.toThrow(LLMSchemaRunError)
  })

  it('respects model override in RunOptions', async () => {
    registerAdapter('alt-provider', testAdapter)

    await runPrompt(config, { name: 'Test' }, { model: 'alt-provider/alt-model' })

    expect(mockCall).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'alt-model' }),
      expect.anything(),
    )
  })

  it('passes temperature and maxTokens to adapter', async () => {
    await runPrompt(config, { name: 'Test' }, { temperature: 0.5, maxTokens: 200 })

    expect(mockCall).toHaveBeenCalledWith(
      expect.objectContaining({ temperature: 0.5, maxTokens: 200 }),
      expect.anything(),
    )
  })

  it('wraps unknown adapter errors in LLMSchemaRunError', async () => {
    mockCall.mockRejectedValueOnce(new TypeError('network fail'))

    try {
      await runPrompt(config, { name: 'Test' })
      expect.fail('expected runPrompt to throw')
    } catch (err) {
      expect(err).toBeInstanceOf(LLMSchemaRunError)
      expect(err).not.toBeInstanceOf(TypeError)
      expect((err as LLMSchemaRunError).message).toContain('network fail')
    }
  })

  it('falls back to adapter.call when callWithOptions is not available', async () => {
    const basicCall = vi.fn().mockResolvedValue({
      text: 'basic call result',
      promptTokens: 3,
      completionTokens: 2,
      totalTokens: 5,
      estimatedCost: 0,
    })
    const basicAdapter: LLMAdapter = { name: 'basic', call: basicCall }
    registerAdapter('basic', basicAdapter)

    const basicConfig: RunPromptConfig = {
      ...config,
      model: 'basic/some-model',
    }

    const result = await runPrompt(basicConfig, { name: 'Test' })
    expect(result.text).toBe('basic call result')
    expect(basicCall).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'some-model', prompt: 'Hello, Test!' }),
    )
  })

  it('re-throws LLMSchemaRunError from adapter without wrapping', async () => {
    const original = new LLMSchemaRunError('p', 'm', 'rate limited')
    mockCall.mockRejectedValueOnce(original)

    try {
      await runPrompt(config, { name: 'Test' })
    } catch (err) {
      expect(err).toBe(original)
    }
  })
})
