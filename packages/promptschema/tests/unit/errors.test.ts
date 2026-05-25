import { describe, it, expect } from 'vitest'
import {
  LLMSchemaError,
  LLMSchemaValidationError,
  LLMSchemaRunError,
  LLMSchemaTimeoutError,
  LLMSchemaRateLimitError,
} from '../../src/errors.js'

describe('LLMSchemaError', () => {
  it('can be instantiated with a message', () => {
    const err = new LLMSchemaError('something went wrong')
    expect(err.message).toBe('something went wrong')
    expect(err.name).toBe('LLMSchemaError')
    expect(err).toBeInstanceOf(Error)
  })
})

describe('LLMSchemaValidationError', () => {
  it('formats a single-field error message', () => {
    const err = new LLMSchemaValidationError('order-assistant', '1.0.0', [
      { field: 'lang', message: 'value is not in enum ["es", "en"]', received: 'fr' },
    ])

    expect(err.message).toContain("input validation failed for prompt 'order-assistant' v1.0.0")
    expect(err.message).toContain('✗ lang: value is not in enum ["es", "en"], received "fr"')
  })

  it('formats multi-field error messages', () => {
    const err = new LLMSchemaValidationError('order-assistant', '1.0.0', [
      { field: 'lang', message: 'invalid enum value' },
      { field: 'total', message: 'must be a positive number', received: -10 },
    ])

    expect(err.issues).toHaveLength(2)
    expect(err.message).toContain('✗ lang: invalid enum value')
    expect(err.message).toContain('✗ total: must be a positive number, received -10')
  })

  it('exposes promptName and promptVersion', () => {
    const err = new LLMSchemaValidationError('my-prompt', '2.1.0', [])
    expect(err.promptName).toBe('my-prompt')
    expect(err.promptVersion).toBe('2.1.0')
  })

  it('is instanceof LLMSchemaError', () => {
    const err = new LLMSchemaValidationError('p', '1.0.0', [])
    expect(err).toBeInstanceOf(LLMSchemaError)
    expect(err).toBeInstanceOf(LLMSchemaValidationError)
    expect(err.name).toBe('LLMSchemaValidationError')
  })

  it('formats error without received value when not provided', () => {
    const err = new LLMSchemaValidationError('p', '1.0.0', [
      { field: 'name', message: 'required' },
    ])
    expect(err.message).toContain('✗ name: required')
    expect(err.message).not.toContain('received')
  })
})

describe('LLMSchemaRunError', () => {
  it('can be instantiated with prompt name and model', () => {
    const err = new LLMSchemaRunError('my-prompt', 'openai/gpt-4o', 'connection failed')
    expect(err.message).toBe('connection failed')
    expect(err.promptName).toBe('my-prompt')
    expect(err.model).toBe('openai/gpt-4o')
    expect(err.name).toBe('LLMSchemaRunError')
  })

  it('preserves the original cause', () => {
    const cause = new Error('network error')
    const err = new LLMSchemaRunError('p', 'openai/gpt-4o', 'failed', cause)
    expect(err.cause).toBe(cause)
  })

  it('is instanceof LLMSchemaError', () => {
    const err = new LLMSchemaRunError('p', 'openai/gpt-4o', 'fail')
    expect(err).toBeInstanceOf(LLMSchemaError)
    expect(err).toBeInstanceOf(LLMSchemaRunError)
  })
})

describe('LLMSchemaTimeoutError', () => {
  it('formats message with timeout duration', () => {
    const err = new LLMSchemaTimeoutError('my-prompt', 'openai/gpt-4o', 30000)
    expect(err.message).toContain('timed out after 30000ms')
    expect(err.timeoutMs).toBe(30000)
    expect(err.name).toBe('LLMSchemaTimeoutError')
  })

  it('is instanceof the full hierarchy', () => {
    const err = new LLMSchemaTimeoutError('p', 'openai/gpt-4o', 5000)
    expect(err).toBeInstanceOf(LLMSchemaError)
    expect(err).toBeInstanceOf(LLMSchemaRunError)
    expect(err).toBeInstanceOf(LLMSchemaTimeoutError)
  })
})

describe('LLMSchemaRateLimitError', () => {
  it('formats message with retry info', () => {
    const err = new LLMSchemaRateLimitError('my-prompt', 'openai/gpt-4o', 60000)
    expect(err.message).toContain('rate limited')
    expect(err.message).toContain('retry after 60000ms')
    expect(err.retryAfterMs).toBe(60000)
    expect(err.name).toBe('LLMSchemaRateLimitError')
  })

  it('works without retryAfterMs', () => {
    const err = new LLMSchemaRateLimitError('p', 'openai/gpt-4o')
    expect(err.message).toContain('rate limited')
    expect(err.message).not.toContain('retry after')
    expect(err.retryAfterMs).toBeUndefined()
  })

  it('is instanceof the full hierarchy', () => {
    const err = new LLMSchemaRateLimitError('p', 'openai/gpt-4o')
    expect(err).toBeInstanceOf(LLMSchemaError)
    expect(err).toBeInstanceOf(LLMSchemaRunError)
    expect(err).toBeInstanceOf(LLMSchemaRateLimitError)
  })
})
