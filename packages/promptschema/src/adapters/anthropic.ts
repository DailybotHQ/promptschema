import type { LLMAdapter, AdapterCallParams, AdapterResult } from '../types.js'
import { LLMSchemaRunError, LLMSchemaRateLimitError } from '../errors.js'
import { requireEnvVar, getEnvVar, registerAdapter } from './adapter-registry.js'
import { estimateCost } from './pricing.js'

export interface AnthropicAdapterOptions {
  apiKey?: string
  baseUrl?: string
  promptName?: string
}

async function callAnthropic(
  params: AdapterCallParams,
  options: AnthropicAdapterOptions = {},
): Promise<AdapterResult> {
  const promptName = options.promptName || '(unknown)'
  const fullModel = `anthropic/${params.model}`
  const apiKey = options.apiKey || requireEnvVar('ANTHROPIC_API_KEY', promptName, fullModel)
  const baseUrl = options.baseUrl || getEnvVar('ANTHROPIC_BASE_URL') || 'https://api.anthropic.com'

  const body: Record<string, unknown> = {
    model: params.model,
    messages: [{ role: 'user', content: params.prompt }],
    max_tokens: params.maxTokens ?? 1024,
  }
  if (params.temperature !== undefined) body.temperature = params.temperature

  const res = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    if (res.status === 429) {
      throw new LLMSchemaRateLimitError(promptName, fullModel)
    }
    const errorBody = await res.text().catch(() => '')
    throw new LLMSchemaRunError(promptName, fullModel, `Anthropic API error ${res.status}: ${errorBody}`)
  }

  const data = await res.json() as {
    content: Array<{ text: string }>
    usage: { input_tokens: number; output_tokens: number }
  }

  const promptTokens = data.usage?.input_tokens ?? 0
  const completionTokens = data.usage?.output_tokens ?? 0

  return {
    text: data.content[0]?.text ?? '',
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    estimatedCost: estimateCost(fullModel, promptTokens, completionTokens),
  }
}

export const anthropicAdapter: LLMAdapter & { callWithOptions: typeof callAnthropic } = {
  name: 'anthropic',
  async call(params: AdapterCallParams): Promise<AdapterResult> {
    return callAnthropic(params)
  },
  callWithOptions: callAnthropic,
}

registerAdapter('anthropic', anthropicAdapter)
