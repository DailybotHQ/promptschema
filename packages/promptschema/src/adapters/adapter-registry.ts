import type { LLMAdapter } from '../types.js'
import { LLMSchemaRunError } from '../errors.js'

const adapterMap = new Map<string, LLMAdapter>()

export function registerAdapter(provider: string, adapter: LLMAdapter): void {
  if (!provider) {
    throw new LLMSchemaRunError('(unknown)', '(unknown)', 'provider name cannot be empty')
  }
  adapterMap.set(provider, adapter)
}

export function resolveAdapter(
  model: string,
  promptName: string,
): { adapter: LLMAdapter; modelName: string } {
  const slashIdx = model.indexOf('/')
  if (slashIdx === -1) {
    throw new LLMSchemaRunError(
      promptName,
      model,
      `invalid model format "${model}" — expected "provider/model" (e.g. "openai/gpt-4o")`,
    )
  }

  const provider = model.slice(0, slashIdx)
  const modelName = model.slice(slashIdx + 1)

  const adapter = adapterMap.get(provider)
  if (!adapter) {
    const available = Array.from(adapterMap.keys()).join(', ') || '(none registered)'
    throw new LLMSchemaRunError(
      promptName,
      model,
      `unknown provider "${provider}" — available providers: ${available}`,
    )
  }

  return { adapter, modelName }
}

export function requireEnvVar(name: string, promptName: string, model: string): string {
  const value = process.env[name]
  if (!value) {
    throw new LLMSchemaRunError(
      promptName,
      model,
      `missing environment variable ${name}\n  prompt '${promptName}' uses model '${model}'\n  → Set ${name} in your environment or pass apiKey in RunOptions`,
    )
  }
  return value
}

export function getEnvVar(name: string): string | undefined {
  return process.env[name]
}
