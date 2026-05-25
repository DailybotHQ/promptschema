import { resolve } from 'node:path'
import { readRegistry, DEFAULT_REGISTRY_PATH } from '../../versioning/index.js'
import { table, green, yellow, dim, CHECK, WARN } from '../output.js'

export async function runStatus(_flags: Record<string, boolean | string>): Promise<void> {
  const registryPath = resolve(process.cwd(), DEFAULT_REGISTRY_PATH)
  const registry = readRegistry(registryPath)

  const names = Object.keys(registry.prompts)
  if (names.length === 0) {
    console.log(`  ${dim('No prompts registered.')}`)
    console.log(`  Define a prompt with definePrompt() and register it.`)
    return
  }

  const headers = ['prompt', 'version', 'state']
  const rows: string[][] = []
  let unsyncedCount = 0

  for (const name of names) {
    const entry = registry.prompts[name]
    const latestHistory = entry.history[0]
    const isSynced = latestHistory?.version === entry.current
    if (!isSynced) unsyncedCount++

    rows.push([
      name,
      `v${entry.current}`,
      isSynced ? green(`${CHECK} synced`) : yellow(`${WARN} unsynced`),
    ])
  }

  console.log()
  console.log(`  ${table(headers, rows).split('\n').join('\n  ')}`)
  console.log()

  if (unsyncedCount > 0) {
    console.log(`  ${unsyncedCount} prompt${unsyncedCount !== 1 ? 's' : ''} need versioning. Run ${green('promptschema bump <name>')}`)
  } else {
    console.log(`  ${green(CHECK)} All prompts synced.`)
  }
}
