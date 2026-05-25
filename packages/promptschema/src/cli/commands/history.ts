import { resolve } from 'node:path'
import {
  readRegistry,
  getPromptEntry,
  DEFAULT_REGISTRY_PATH,
} from '../../versioning/index.js'
import { bold, dim, red, yellow, CROSS, WARN } from '../output.js'

export async function runHistory(
  args: string[],
  flags: Record<string, boolean | string>,
): Promise<void> {
  const name = args[0]
  if (!name) {
    console.error(`  ${red(CROSS)} Missing prompt name.`)
    console.log(`  Usage: promptschema history <name>`)
    process.exitCode = 1
    return
  }

  const registryPath = resolve(process.cwd(), DEFAULT_REGISTRY_PATH)
  const registry = readRegistry(registryPath)

  const entry = getPromptEntry(registry, name)
  if (!entry) {
    console.error(`  ${red(CROSS)} Prompt "${name}" not found in registry.`)
    process.exitCode = 1
    return
  }

  if (entry.history.length === 0) {
    console.log(`  ${dim('No version history for')} ${name}`)
    return
  }

  console.log()
  console.log(`  ${bold(name)} — version history`)
  console.log()

  for (const h of entry.history) {
    const date = new Date(h.createdAt).toISOString().slice(0, 10)
    const author = h.author || '-'
    const changelog = h.changelog || '-'
    const breaking = h.breaking ? `  ${yellow(`${WARN} breaking`)}` : ''
    console.log(`  v${h.version}   ${date}   ${author}   ${changelog}${breaking}`)
  }
}
