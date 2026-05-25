import { resolve } from 'node:path'
import {
  readRegistry,
  getPromptEntry,
  diffPromptVersions,
  formatDiff,
  DEFAULT_REGISTRY_PATH,
} from '../../versioning/index.js'
import { red, CROSS } from '../output.js'

export async function runDiff(
  args: string[],
  flags: Record<string, boolean | string>,
): Promise<void> {
  const [name, v1, v2] = args

  if (!name || !v1 || !v2) {
    console.error(`  ${red(CROSS)} Missing arguments.`)
    console.log(`  Usage: promptschema diff <name> <v1> <v2>`)
    process.exitCode = 1
    return
  }

  const registryPath = resolve(process.cwd(), DEFAULT_REGISTRY_PATH)
  const registry = await readRegistry(registryPath)

  const entry = getPromptEntry(registry, name)
  if (!entry) {
    console.error(`  ${red(CROSS)} Prompt "${name}" not found in registry.`)
    process.exitCode = 1
    return
  }

  try {
    const diff = diffPromptVersions(registry, name, v1, v2)
    const output = formatDiff(diff)
    console.log()
    console.log(output)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`  ${red(CROSS)} ${message}`)
    process.exitCode = 1
  }
}
