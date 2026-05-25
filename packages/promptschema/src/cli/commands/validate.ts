import { resolve } from 'node:path'
import { readRegistry, DEFAULT_REGISTRY_PATH } from '../../versioning/index.js'
import { green, red, CHECK, CROSS } from '../output.js'

export async function runValidate(_flags: Record<string, boolean | string>): Promise<void> {
  const registryPath = resolve(process.cwd(), DEFAULT_REGISTRY_PATH)
  const registry = readRegistry(registryPath)

  const names = Object.keys(registry.prompts)
  if (names.length === 0) {
    console.log(`  ${green(CHECK)} No prompts registered — nothing to validate.`)
    return
  }

  const unsynced: string[] = []
  for (const name of names) {
    const entry = registry.prompts[name]
    const latestHistory = entry.history[0]
    if (latestHistory?.version !== entry.current) {
      unsynced.push(name)
    }
  }

  if (unsynced.length === 0) {
    console.log(`  ${green(CHECK)} ${names.length} prompt${names.length !== 1 ? 's' : ''} validated. Registry synced.`)
    return
  }

  for (const name of unsynced) {
    console.log(`  ${red(CROSS)} ${name} has unversioned changes`)
    console.log(`    Run ${green(`promptschema bump ${name}`)} before merging.`)
  }
  console.log()

  process.exitCode = 1
}
