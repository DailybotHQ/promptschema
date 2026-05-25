import type { LLMAdapter, AdapterCallParams, AdapterResult } from '../types.js'
import { LLMSchemaRunError, LLMSchemaRateLimitError } from '../errors.js'
import { requireEnvVar, getEnvVar, registerAdapter } from './adapter-registry.js'
import { estimateCost } from './pricing.js'

export interface GeminiAdapterOptions {
  apiKey?: string
  baseUrl?: string
  promptName?: string
}

function resolveGeminiKey(promptName: string, model: string, override?: string): string {
  if (override) return override
  return getEnvVar('GEMINI_API_KEY')
    ?? getEnvVar('GOOGLE_API_KEY')
    ?? requireEnvVar('GEMINI_API_KEY', promptName, model)
}

async function callGemini(
  params: AdapterCallParams,
  options: GeminiAdapterOptions = {},
): Promise<AdapterResult> {
  const promptName = options.promptName || '(unknown)'
  const fullModel = `gemini/${params.model}`
  const apiKey = resolveGeminiKey(promptName, fullModel, options.apiKey)
  const baseUrl = options.baseUrl || 'https://generativelanguage.googleapis.com'

  const body: Record<string, unknown> = {
    contents: [{ parts: [{ text: params.prompt }] }],
  }

  const generationConfig: Record<string, unknown> = {}
  if (params.temperature !== undefined) generationConfig.temperature = params.temperature
  if (params.maxTokens !== undefined) generationConfig.maxOutputTokens = params.maxTokens
  if (Object.keys(generationConfig).length > 0) body.generationConfig = generationConfig

  const url = `${baseUrl}/v1beta/models/${params.model}:generateContent?key=${apiKey}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    if (res.status === 429) {
      throw new LLMSchemaRateLimitError(promptName, fullModel)
    }
    const errorBody = await res.text().catch(() => '')
    throw new LLMSchemaRunError(promptName, fullModel, `Gemini API error ${res.status}: ${errorBody}`)
  }

  const data = await res.json() as {
    candidates: Array<{ content: { parts: Array<{ text: string }> } }>
    usageMetadata: { promptTokenCount: number; candidatesTokenCount: number; totalTokenCount: number }
  }

  const promptTokens = data.usageMetadata?.promptTokenCount ?? 0
  const completionTokens = data.usageMetadata?.candidatesTokenCount ?? 0

  return {
    text: data.candidates?.[0]?.content?.parts?.[0]?.text ?? '',
    promptTokens,
    completionTokens,
    totalTokens: data.usageMetadata?.totalTokenCount ?? promptTokens + completionTokens,
    estimatedCost: estimateCost(fullModel, promptTokens, completionTokens),
  }
}

export const geminiAdapter: LLMAdapter & { callWithOptions: typeof callGemini } = {
  name: 'gemini',
  async call(params: AdapterCallParams): Promise<AdapterResult> {
    return callGemini(params)
  },
  callWithOptions: callGemini,
}

registerAdapter('gemini', geminiAdapter)
