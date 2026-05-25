import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { runStatus } from '../../../src/cli/commands/status.js'
import type { Registry } from '../../../src/versioning/registry-types.js'

vi.mock('../../../src/versioning/registry.js', () => ({
  readRegistry: vi.fn(),
  DEFAULT_REGISTRY_PATH: 'promptschema.registry.json',
}))

import { readRegistry } from '../../../src/versioning/registry.js'

function makeRegistry(prompts: Registry['prompts']): Registry {
  return { $schema: '', version: '1', prompts }
}

describe('runStatus', () => {
  let logs: string[]

  beforeEach(() => {
    logs = []
    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      logs.push(args.join(' '))
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows empty message for no prompts', async () => {
    vi.mocked(readRegistry).mockReturnValue(makeRegistry({}))

    await runStatus({})

    expect(logs.some((l) => l.includes('No prompts registered'))).toBe(true)
  })

  it('shows synced state when history matches current', async () => {
    vi.mocked(readRegistry).mockReturnValue(makeRegistry({
      'my-prompt': {
        current: '1.0.0',
        history: [{ version: '1.0.0', createdAt: '', author: '', templateHash: '', schemaHash: '', model: '', changelog: '', breaking: false, schema: {} }],
      },
    }))

    await runStatus({})

    const output = logs.join('\n')
    expect(output).toContain('synced')
    expect(output).toContain('All prompts synced')
  })

  it('shows unsynced when history does not match current', async () => {
    vi.mocked(readRegistry).mockReturnValue(makeRegistry({
      'my-prompt': {
        current: '2.0.0',
        history: [{ version: '1.0.0', createdAt: '', author: '', templateHash: '', schemaHash: '', model: '', changelog: '', breaking: false, schema: {} }],
      },
    }))

    await runStatus({})

    const output = logs.join('\n')
    expect(output).toContain('unsynced')
    expect(output).toContain('need versioning')
  })
})
