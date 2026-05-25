import type { LLMAdapter, AdapterCallParams, AdapterResult } from '../types.js'
import { LLMSchemaRunError, LLMSchemaRateLimitError } from '../errors.js'
import { requireEnvVar, getEnvVar, registerAdapter } from './adapter-registry.js'
import { estimateCost } from './pricing.js'

export interface OpenAIAdapterOptions {
  apiKey?: string
  baseUrl?: string
  promptName?: string
}

async function callOpenAI(
  params: AdapterCallParams,
  options: OpenAIAdapterOptions = {},
): Promise<AdapterResult> {
  const promptName = options.promptName || '(unknown)'
  const fullModel = `openai/${params.model}`
  const apiKey = options.apiKey || requireEnvVar('OPENAI_API_KEY', promptName, fullModel)
  const baseUrl = options.baseUrl || getEnvVar('OPENAI_BASE_URL') || 'https://api.openai.com'

  const body: Record<string, unknown> = {
    model: params.model,
    messages: [{ role: 'user', content: params.prompt }],
  }
  if (params.temperature !== undefined) body.temperature = params.temperature
  if (params.maxTokens !== undefined) body.max_tokens = params.maxTokens

  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    if (res.status === 429) {
      const retryAfter = res.headers.get('retry-after')
      throw new LLMSchemaRateLimitError(promptName, fullModel, retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined)
    }
    const errorBody = await res.text().catch(() => '')
    throw new LLMSchemaRunError(promptName, fullModel, `OpenAI API error ${res.status}: ${errorBody}`)
  }

  const data = await res.json() as {
    choices: Array<{ message: { content: string } }>
    usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
  }

  const promptTokens = data.usage?.prompt_tokens ?? 0
  const completionTokens = data.usage?.completion_tokens ?? 0

  return {
    text: data.choices[0]?.message?.content ?? '',
    promptTokens,
    completionTokens,
    totalTokens: data.usage?.total_tokens ?? promptTokens + completionTokens,
    estimatedCost: estimateCost(fullModel, promptTokens, completionTokens),
  }
}

export const openaiAdapter: LLMAdapter & { callWithOptions: typeof callOpenAI } = {
  name: 'openai',
  async call(params: AdapterCallParams): Promise<AdapterResult> {
    return callOpenAI(params)
  },
  callWithOptions: callOpenAI,
}

registerAdapter('openai', openaiAdapter)
