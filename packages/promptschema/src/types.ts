import type { ZodType } from 'zod'

export interface PromptUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  estimatedCost: number
}

export interface PromptResult {
  text: string
  usage: PromptUsage
  model: string
  version: string
  latencyMs: number
}

export interface PromptDefinition<TInput> {
  name: string
  version: string
  model: string
  input: ZodType<TInput>
  template: (input: TInput) => string
}

export interface RunOptions {
  model?: string
  apiKey?: string
  baseUrl?: string
  temperature?: number
  maxTokens?: number
}

export interface PromptInstance<TInput> {
  readonly name: string
  readonly version: string
  readonly model: string
  validate(input: unknown): TInput
  render(input: TInput): string
  run(input: TInput, options?: RunOptions): Promise<PromptResult>
}

export interface AdapterCallParams {
  model: string
  prompt: string
  temperature?: number
  maxTokens?: number
}

export interface AdapterResult {
  text: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  estimatedCost: number
}

export interface LLMAdapter {
  name: string
  call(params: AdapterCallParams): Promise<AdapterResult>
}
