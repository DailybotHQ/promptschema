export const PRICING: Record<string, { input: number; output: number }> = {
  'openai/gpt-4o': { input: 0.0000025, output: 0.000010 },
  'openai/gpt-4o-mini': { input: 0.00000015, output: 0.00000060 },
  'openai/gpt-4-turbo': { input: 0.00001, output: 0.00003 },
  'openai/o1': { input: 0.000015, output: 0.00006 },
  'openai/o1-mini': { input: 0.000003, output: 0.000012 },
  'openai/o3-mini': { input: 0.0000011, output: 0.0000044 },

  'anthropic/claude-opus-4-6': { input: 0.000015, output: 0.000075 },
  'anthropic/claude-sonnet-4-6': { input: 0.000003, output: 0.000015 },
  'anthropic/claude-haiku-4-5': { input: 0.0000008, output: 0.000004 },

  'gemini/gemini-2.0-flash': { input: 0.00000010, output: 0.00000040 },
  'gemini/gemini-2.0-flash-lite': { input: 0.00000005, output: 0.00000020 },
  'gemini/gemini-1.5-pro': { input: 0.0000025, output: 0.000010 },
}

export function estimateCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const pricing = PRICING[model]
  if (!pricing) return 0
  return promptTokens * pricing.input + completionTokens * pricing.output
}
