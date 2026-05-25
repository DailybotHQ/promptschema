import type { ZodType } from 'zod'
import type { PromptResult, RunOptions } from './types.js'
import { LLMSchemaRunError } from './errors.js'
import { validateInput } from './schema.js'
import { resolveAdapter } from './adapters/adapter-registry.js'

export interface RunPromptConfig {
  name: string
  version: string
  model: string
  input: ZodType
  template: (input: unknown) => string
}

export async function runPrompt(
  config: RunPromptConfig,
  rawInput: unknown,
  options: RunOptions = {},
): Promise<PromptResult> {
  const validated = validateInput(config.input, rawInput, config.name, config.version)

  const rendered = config.template(validated)

  const effectiveModel = options.model || config.model
  const { adapter, modelName } = resolveAdapter(effectiveModel, config.name)

  const start = performance.now()

  try {
    const adapterWithOptions = adapter as typeof adapter & {
      callWithOptions?: (
        params: { model: string; prompt: string; temperature?: number; maxTokens?: number },
        opts: { apiKey?: string; baseUrl?: string; promptName?: string },
      ) => Promise<{ text: string; promptTokens: number; completionTokens: number; totalTokens: number; estimatedCost: number }>
    }

    const callParams = {
      model: modelName,
      prompt: rendered,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
    }

    const result = adapterWithOptions.callWithOptions
      ? await adapterWithOptions.callWithOptions(callParams, {
          apiKey: options.apiKey,
          baseUrl: options.baseUrl,
          promptName: config.name,
        })
      : await adapter.call(callParams)

    const latencyMs = performance.now() - start

    return {
      text: result.text,
      usage: {
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        totalTokens: result.totalTokens,
        estimatedCost: result.estimatedCost,
      },
      model: effectiveModel,
      version: config.version,
      latencyMs,
    }
  } catch (error) {
    if (error instanceof LLMSchemaRunError) throw error
    const cause = error instanceof Error ? error : new Error(String(error))
    throw new LLMSchemaRunError(
      config.name,
      effectiveModel,
      `adapter call failed: ${cause.message}`,
      cause,
    )
  }
}
