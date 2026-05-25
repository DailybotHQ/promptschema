import { resolve } from 'node:path'
import {
  readRegistry,
  writeRegistry,
  getPromptEntry,
  incrementVersion,
  DEFAULT_REGISTRY_PATH,
} from '../../versioning/index.js'
import type { BumpType, RegistryHistoryEntry } from '../../versioning/index.js'
import { green, red, CHECK, CROSS, ARROW } from '../output.js'

export async function runBump(
  args: string[],
  flags: Record<string, boolean | string>,
): Promise<void> {
  const name = args[0]
  if (!name) {
    console.error(`  ${red(CROSS)} Missing prompt name.`)
    console.log(`  Usage: promptschema bump <name> [--patch|--minor|--major]`)
    process.exitCode = 1
    return
  }

  const registryPath = resolve(process.cwd(), DEFAULT_REGISTRY_PATH)
  const registry = readRegistry(registryPath)

  const entry = getPromptEntry(registry, name)
  if (!entry) {
    const available = Object.keys(registry.prompts)
    console.error(`  ${red(CROSS)} Prompt "${name}" not found in registry.`)
    if (available.length > 0) {
      console.log(`  Available prompts: ${available.join(', ')}`)
    }
    process.exitCode = 1
    return
  }

  let bumpType: BumpType = 'patch'
  if (flags.major) bumpType = 'major'
  else if (flags.minor) bumpType = 'minor'
  else if (flags.patch) bumpType = 'patch'

  const oldVersion = entry.current
  const newVersion = incrementVersion(oldVersion, bumpType)
  const latestHistory = entry.history[0]

  const newHistoryEntry: RegistryHistoryEntry = {
    version: newVersion,
    createdAt: new Date().toISOString(),
    author: process.env.USER || process.env.USERNAME || 'unknown',
    templateHash: latestHistory?.templateHash ?? '',
    schemaHash: latestHistory?.schemaHash ?? '',
    model: latestHistory?.model ?? '',
    changelog: `${bumpType} bump via CLI`,
    breaking: bumpType === 'major',
    schema: latestHistory?.schema ?? {},
  }

  const updated = {
    ...registry,
    prompts: {
      ...registry.prompts,
      [name]: {
        current: newVersion,
        history: [newHistoryEntry, ...entry.history],
      },
    },
  }

  writeRegistry(registryPath, updated)

  console.log()
  console.log(`  ${name}: v${oldVersion} ${ARROW} v${newVersion} (${bumpType})`)
  console.log()
  console.log(`  ${green(CHECK)} Registry updated at ${DEFAULT_REGISTRY_PATH}`)
  console.log(`  ${green(CHECK)} Commit the registry to persist changes.`)
}
