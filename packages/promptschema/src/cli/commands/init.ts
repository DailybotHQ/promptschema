import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createEmptyRegistry, writeRegistry, DEFAULT_REGISTRY_PATH } from '../../versioning/index.js'
import { green, yellow, CHECK, WARN } from '../output.js'

export async function runInit(_flags: Record<string, boolean | string>): Promise<void> {
  const registryPath = resolve(process.cwd(), DEFAULT_REGISTRY_PATH)

  if (existsSync(registryPath)) {
    console.log(`  ${yellow(WARN)} Registry already exists at ${DEFAULT_REGISTRY_PATH}`)
    console.log(`    Use ${green('promptschema status')} to check your prompts.`)
    return
  }

  const registry = createEmptyRegistry()
  writeRegistry(registryPath, registry)

  console.log(`  ${green(CHECK)} Registry created at ${DEFAULT_REGISTRY_PATH}`)
  console.log()
  console.log(`  Next steps:`)
  console.log(`    1. Define your first prompt with definePrompt()`)
  console.log(`    2. Run ${green('promptschema status')} to check sync state`)
}
