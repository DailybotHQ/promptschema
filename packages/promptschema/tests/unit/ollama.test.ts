import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { LLMSchemaRunError } from '../../src/errors.js'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

const { ollamaAdapter } = await import('../../src/adapters/ollama.js')

describe('ollamaAdapter', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    fetchMock.mockReset()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('has correct name', () => {
    expect(ollamaAdapter.name).toBe('ollama')
  })

  it('sends correct request and parses response', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        message: { content: 'Local response' },
        prompt_eval_count: 15,
        eval_count: 25,
      }),
    })

    const result = await ollamaAdapter.callWithOptions(
      { model: 'llama3', prompt: 'Hello', temperature: 0.8, maxTokens: 200 },
      { promptName: 'test' },
    )

    expect(result.text).toBe('Local response')
    expect(result.promptTokens).toBe(15)
    expect(result.completionTokens).toBe(25)
    expect(result.totalTokens).toBe(40)
    expect(result.estimatedCost).toBe(0)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:11434/api/chat')
    const body = JSON.parse(options.body)
    expect(body.model).toBe('llama3')
    expect(body.stream).toBe(false)
    expect(body.options.temperature).toBe(0.8)
    expect(body.options.num_predict).toBe(200)
  })

  it('uses custom OLLAMA_BASE_URL', async () => {
    process.env.OLLAMA_BASE_URL = 'http://gpu-server:11434'

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        message: { content: 'ok' },
        prompt_eval_count: 5,
        eval_count: 3,
      }),
    })

    await ollamaAdapter.callWithOptions(
      { model: 'llama3', prompt: 'test' },
      { promptName: 'test' },
    )

    const [url] = fetchMock.mock.calls[0]
    expect(url).toBe('http://gpu-server:11434/api/chat')
  })

  it('throws LLMSchemaRunError on API error', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'model not found',
    })

    await expect(
      ollamaAdapter.callWithOptions(
        { model: 'nonexistent', prompt: 'test' },
        { promptName: 'test' },
      ),
    ).rejects.toThrow(LLMSchemaRunError)
  })

  it('call() works without options', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        message: { content: 'via call' },
        prompt_eval_count: 3,
        eval_count: 2,
      }),
    })

    const result = await ollamaAdapter.call({ model: 'llama3', prompt: 'test' })
    expect(result.text).toBe('via call')
  })

  it('does not require any API key', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        message: { content: 'no key needed' },
      }),
    })

    const result = await ollamaAdapter.callWithOptions(
      { model: 'llama3', prompt: 'hi' },
      { promptName: 'test' },
    )

    expect(result.text).toBe('no key needed')
  })
})
