import { definePrompt, z } from 'promptschema'

/**
 * Example — actually call an LLM via the built-in adapter.
 *
 * Requires:
 *   export OPENAI_API_KEY=sk-...
 *
 * Run:
 *   npx tsx examples/typescript/with-llm.ts
 */

const translatePrompt = definePrompt({
  name: 'translator',
  version: '1.0.0',
  model: 'openai/gpt-4o-mini',
  input: z.object({
    text: z.string(),
    targetLang: z.string(),
  }),
  template: (i) => `
    Translate the following text to ${i.targetLang}.
    Respond with the translation only, no explanations.

    Text: ${i.text}
  `,
})

async function main() {
  const result = await translatePrompt.run(
    { text: 'Hello, how are you?', targetLang: 'Spanish' },
    { temperature: 0.3, maxTokens: 100 },
  )

  console.log('Translation:', result.text)
  console.log('Tokens used:', result.usage.totalTokens)
  console.log('Estimated cost: $', result.usage.estimatedCost.toFixed(6))
}

main().catch(console.error)
