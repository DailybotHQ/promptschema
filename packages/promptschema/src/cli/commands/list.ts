import { resolve } from 'node:path'
import { readRegistry, DEFAULT_REGISTRY_PATH } from '../../versioning/index.js'
import { table, dim, bold } from '../output.js'

export async function runList(_flags: Record<string, boolean | string>): Promise<void> {
  const registryPath = resolve(process.cwd(), DEFAULT_REGISTRY_PATH)
  const registry = readRegistry(registryPath)

  const names = Object.keys(registry.prompts)
  if (names.length === 0) {
    console.log(`  ${dim('No prompts registered.')}`)
    console.log(`  Define a prompt with definePrompt() and register it.`)
    return
  }

  const headers = ['name', 'version', 'model', 'last modified']
  const rows = names.map((name) => {
    const entry = registry.prompts[name]
    const latestHistory = entry.history[0]
    const model = latestHistory?.model ?? '-'
    const date = latestHistory?.createdAt
      ? new Date(latestHistory.createdAt).toISOString().slice(0, 10)
      : '-'
    return [name, `v${entry.current}`, model, date]
  })

  console.log()
  console.log(`  ${table(headers, rows).split('\n').join('\n  ')}`)
  console.log()
  console.log(`  ${bold(String(names.length))} prompt${names.length !== 1 ? 's' : ''} registered.`)
}
