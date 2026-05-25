import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { LLMSchemaRunError, LLMSchemaRateLimitError } from '../../src/errors.js'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

const { geminiAdapter } = await import('../../src/adapters/gemini.js')

describe('geminiAdapter', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv, GEMINI_API_KEY: 'test-gemini-key' }
    fetchMock.mockReset()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('has correct name', () => {
    expect(geminiAdapter.name).toBe('gemini')
  })

  it('sends correct request and parses response', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'Generated text' }] } }],
        usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 10, totalTokenCount: 30 },
      }),
    })

    const result = await geminiAdapter.callWithOptions(
      { model: 'gemini-2.0-flash', prompt: 'Hello', temperature: 0.3, maxTokens: 150 },
      { apiKey: 'my-key', promptName: 'test' },
    )

    expect(result.text).toBe('Generated text')
    expect(result.promptTokens).toBe(20)
    expect(result.completionTokens).toBe(10)
    expect(result.totalTokens).toBe(30)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toContain('gemini-2.0-flash:generateContent')
    expect(url).toContain('key=my-key')
    const body = JSON.parse(options.body)
    expect(body.contents[0].parts[0].text).toBe('Hello')
    expect(body.generationConfig.temperature).toBe(0.3)
    expect(body.generationConfig.maxOutputTokens).toBe(150)
  })

  it('call() works without options', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'via call' }] } }],
        usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 1, totalTokenCount: 3 },
      }),
    })

    const result = await geminiAdapter.call({ model: 'gemini-2.0-flash', prompt: 'test' })
    expect(result.text).toBe('via call')
  })

  it('falls back to GOOGLE_API_KEY when GEMINI_API_KEY is not set', async () => {
    delete process.env.GEMINI_API_KEY
    process.env.GOOGLE_API_KEY = 'google-key'

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'ok' }] } }],
        usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 },
      }),
    })

    await geminiAdapter.callWithOptions(
      { model: 'gemini-2.0-flash', prompt: 'test' },
      { promptName: 'test' },
    )

    const [url] = fetchMock.mock.calls[0]
    expect(url).toContain('key=google-key')
  })

  it('throws LLMSchemaRateLimitError on 429', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: new Map(),
    })

    await expect(
      geminiAdapter.callWithOptions(
        { model: 'gemini-2.0-flash', prompt: 'test' },
        { apiKey: 'key', promptName: 'test' },
      ),
    ).rejects.toThrow(LLMSchemaRateLimitError)
  })

  it('throws LLMSchemaRunError on non-429 error', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: new Map(),
      text: async () => 'Server error',
    })

    await expect(
      geminiAdapter.callWithOptions(
        { model: 'gemini-2.0-flash', prompt: 'test' },
        { apiKey: 'key', promptName: 'test' },
      ),
    ).rejects.toThrow(LLMSchemaRunError)
  })
})
