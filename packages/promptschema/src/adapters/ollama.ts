import type { LLMAdapter, AdapterCallParams, AdapterResult } from '../types.js'
import { LLMSchemaRunError } from '../errors.js'
import { getEnvVar, registerAdapter } from './adapter-registry.js'

export interface OllamaAdapterOptions {
  baseUrl?: string
  promptName?: string
}

async function callOllama(
  params: AdapterCallParams,
  options: OllamaAdapterOptions = {},
): Promise<AdapterResult> {
  const promptName = options.promptName || '(unknown)'
  const fullModel = `ollama/${params.model}`
  const baseUrl = options.baseUrl || getEnvVar('OLLAMA_BASE_URL') || 'http://localhost:11434'

  const body: Record<string, unknown> = {
    model: params.model,
    messages: [{ role: 'user', content: params.prompt }],
    stream: false,
  }

  const ollamaOptions: Record<string, unknown> = {}
  if (params.temperature !== undefined) ollamaOptions.temperature = params.temperature
  if (params.maxTokens !== undefined) ollamaOptions.num_predict = params.maxTokens
  if (Object.keys(ollamaOptions).length > 0) body.options = ollamaOptions

  const res = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errorBody = await res.text().catch(() => '')
    throw new LLMSchemaRunError(promptName, fullModel, `Ollama API error ${res.status}: ${errorBody}`)
  }

  const data = await res.json() as {
    message: { content: string }
    prompt_eval_count?: number
    eval_count?: number
  }

  const promptTokens = data.prompt_eval_count ?? 0
  const completionTokens = data.eval_count ?? 0

  return {
    text: data.message?.content ?? '',
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    estimatedCost: 0,
  }
}

export const ollamaAdapter: LLMAdapter & { callWithOptions: typeof callOllama } = {
  name: 'ollama',
  async call(params: AdapterCallParams): Promise<AdapterResult> {
    return callOllama(params)
  },
  callWithOptions: callOllama,
}

registerAdapter('ollama', ollamaAdapter)
