import { definePrompt, z } from 'promptschema'

/**
 * Basic example — define a typed prompt and render it.
 *
 * Run:
 *   npx tsx examples/typescript/basic.ts
 */

const greetingPrompt = definePrompt({
  name: 'greeting',
  version: '1.0.0',
  model: 'openai/gpt-4o',
  input: z.object({
    name: z.string().min(1),
    tone: z.enum(['formal', 'casual']),
  }),
  template: (i) => `
    You are a friendly assistant.
    Greet the user "${i.name}" in a ${i.tone} tone.
    Keep it under 2 sentences.
  `,
})

// Render returns the interpolated prompt string (no LLM call)
const rendered = greetingPrompt.render({ name: 'Oscar', tone: 'casual' })
console.log('Rendered prompt:\n', rendered)

// Validate checks inputs against the schema — throws on invalid data
try {
  greetingPrompt.validate({ name: '', tone: 'casual' })
} catch (err) {
  console.log('\nValidation error (expected):', (err as Error).message)
}
