import { definePrompt, z, registerAdapter } from 'promptschema'

/**
 * Example — register a custom LLM adapter.
 *
 * Run:
 *   npx tsx examples/typescript/custom-adapter.ts
 */

registerAdapter('echo', {
  name: 'echo',
  async call({ prompt }) {
    return {
      text: `[ECHO] ${prompt}`,
      promptTokens: prompt.length,
      completionTokens: prompt.length,
      totalTokens: prompt.length * 2,
      estimatedCost: 0,
    }
  },
})

const echoPrompt = definePrompt({
  name: 'echo-test',
  version: '1.0.0',
  model: 'echo/v1',
  input: z.object({
    message: z.string(),
  }),
  template: (i) => `Say: ${i.message}`,
})

async function main() {
  const result = await echoPrompt.run({ message: 'hello world' })
  console.log('Response:', result.text)
}

main().catch(console.error)
