import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { LLMSchemaRunError, LLMSchemaRateLimitError } from '../../src/errors.js'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

const { anthropicAdapter } = await import('../../src/adapters/anthropic.js')

describe('anthropicAdapter', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv, ANTHROPIC_API_KEY: 'test-key-123' }
    fetchMock.mockReset()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('has correct name', () => {
    expect(anthropicAdapter.name).toBe('anthropic')
  })

  it('sends correct request and parses response', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{ text: 'Bonjour!' }],
        usage: { input_tokens: 12, output_tokens: 8 },
      }),
    })

    const result = await anthropicAdapter.callWithOptions(
      { model: 'claude-sonnet-4-6', prompt: 'Salut', temperature: 0.5, maxTokens: 200 },
      { apiKey: 'test-key', promptName: 'test' },
    )

    expect(result.text).toBe('Bonjour!')
    expect(result.promptTokens).toBe(12)
    expect(result.completionTokens).toBe(8)
    expect(result.totalTokens).toBe(20)
    expect(result.estimatedCost).toBeGreaterThanOrEqual(0)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    const body = JSON.parse(options.body)
    expect(body.model).toBe('claude-sonnet-4-6')
    expect(body.max_tokens).toBe(200)
    expect(options.headers['x-api-key']).toBe('test-key')
    expect(options.headers['anthropic-version']).toBe('2023-06-01')
  })

  it('throws LLMSchemaRateLimitError on 429', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: new Map(),
    })

    await expect(
      anthropicAdapter.callWithOptions(
        { model: 'claude-sonnet-4-6', prompt: 'test' },
        { apiKey: 'key', promptName: 'test' },
      ),
    ).rejects.toThrow(LLMSchemaRateLimitError)
  })

  it('call() works without options', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{ text: 'via call' }],
        usage: { input_tokens: 5, output_tokens: 3 },
      }),
    })

    const result = await anthropicAdapter.call({ model: 'claude-sonnet-4-6', prompt: 'Hi' })
    expect(result.text).toBe('via call')
  })

  it('throws LLMSchemaRunError on non-429 error', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      headers: new Map(),
      text: async () => 'Bad Request',
    })

    await expect(
      anthropicAdapter.callWithOptions(
        { model: 'claude-sonnet-4-6', prompt: 'test' },
        { apiKey: 'key', promptName: 'test' },
      ),
    ).rejects.toThrow(LLMSchemaRunError)
  })
})
