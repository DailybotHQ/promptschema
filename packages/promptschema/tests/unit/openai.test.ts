import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { LLMSchemaRunError, LLMSchemaRateLimitError } from '../../src/errors.js'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

const { openaiAdapter } = await import('../../src/adapters/openai.js')

describe('openaiAdapter', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv, OPENAI_API_KEY: 'test-key-123' }
    fetchMock.mockReset()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('has correct name', () => {
    expect(openaiAdapter.name).toBe('openai')
  })

  it('sends correct request and parses response', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Hello there!' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    })

    const result = await openaiAdapter.callWithOptions(
      { model: 'gpt-4o', prompt: 'Hi', temperature: 0.7, maxTokens: 100 },
      { apiKey: 'test-key', promptName: 'test' },
    )

    expect(result.text).toBe('Hello there!')
    expect(result.promptTokens).toBe(10)
    expect(result.completionTokens).toBe(5)
    expect(result.totalTokens).toBe(15)
    expect(result.estimatedCost).toBeGreaterThan(0)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.openai.com/v1/chat/completions')
    expect(options.method).toBe('POST')
    const body = JSON.parse(options.body)
    expect(body.model).toBe('gpt-4o')
    expect(body.temperature).toBe(0.7)
    expect(body.max_tokens).toBe(100)
  })

  it('uses custom baseUrl', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'ok' } }],
        usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
      }),
    })

    await openaiAdapter.callWithOptions(
      { model: 'gpt-4o', prompt: 'test' },
      { apiKey: 'key', baseUrl: 'https://custom.api.com', promptName: 'test' },
    )

    const [url] = fetchMock.mock.calls[0]
    expect(url).toBe('https://custom.api.com/v1/chat/completions')
  })

  it('throws LLMSchemaRateLimitError on 429', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: new Map([['retry-after', '30']]),
    })

    await expect(
      openaiAdapter.callWithOptions(
        { model: 'gpt-4o', prompt: 'test' },
        { apiKey: 'key', promptName: 'test' },
      ),
    ).rejects.toThrow(LLMSchemaRateLimitError)
  })

  it('throws LLMSchemaRunError on non-429 error', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: new Map(),
      text: async () => 'Internal Server Error',
    })

    await expect(
      openaiAdapter.callWithOptions(
        { model: 'gpt-4o', prompt: 'test' },
        { apiKey: 'key', promptName: 'test' },
      ),
    ).rejects.toThrow(LLMSchemaRunError)
  })

  it('throws when API key is missing and not provided', async () => {
    delete process.env.OPENAI_API_KEY

    await expect(
      openaiAdapter.call({ model: 'gpt-4o', prompt: 'test' }),
    ).rejects.toThrow(LLMSchemaRunError)
  })
})
