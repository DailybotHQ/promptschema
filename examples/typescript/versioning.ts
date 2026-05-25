import {
  createRegistry,
  registerPrompt,
  bumpPrompt,
  diffPromptVersions,
  formatDiff,
} from 'promptschema'

/**
 * Example — prompt versioning with the registry.
 *
 * Run:
 *   npx tsx examples/typescript/versioning.ts
 */

// Start with a fresh in-memory registry
let registry = createRegistry()

// Register a prompt for the first time
registry = registerPrompt(registry, {
  name: 'summarizer',
  version: '1.0.0',
  templateHash: 'abc123',
  schemaHash: 'def456',
})
console.log('Registered v1.0.0')

// Bump with a template change (minor bump)
registry = bumpPrompt(registry, {
  name: 'summarizer',
  bumpType: 'minor',
  newTemplateHash: 'abc999',
})
console.log('Bumped to:', registry.prompts['summarizer'].current)

// View diff between versions
const diff = diffPromptVersions(registry, 'summarizer', '1.0.0', '1.1.0')
if (diff) {
  console.log('\nDiff 1.0.0 → 1.1.0:')
  console.log(formatDiff(diff))
}
