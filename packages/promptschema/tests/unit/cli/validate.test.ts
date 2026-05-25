import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { runValidate } from '../../../src/cli/commands/validate.js'
import type { Registry } from '../../../src/versioning/registry-types.js'

vi.mock('../../../src/versioning/registry.js', () => ({
  readRegistry: vi.fn(),
  DEFAULT_REGISTRY_PATH: 'promptschema.registry.json',
}))

import { readRegistry } from '../../../src/versioning/registry.js'

function makeRegistry(prompts: Registry['prompts']): Registry {
  return { $schema: '', version: '1', prompts }
}

describe('runValidate', () => {
  let logs: string[]
  let errors: string[]

  beforeEach(() => {
    logs = []
    errors = []
    process.exitCode = undefined as unknown as number
    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      logs.push(args.join(' '))
    })
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      errors.push(args.join(' '))
    })
  })

  afterEach(() => {
    process.exitCode = undefined as unknown as number
    vi.restoreAllMocks()
  })

  it('exits 0 when all prompts are synced', async () => {
    vi.mocked(readRegistry).mockReturnValue(makeRegistry({
      'my-prompt': {
        current: '1.0.0',
        history: [{ version: '1.0.0', createdAt: '', author: '', templateHash: '', schemaHash: '', model: '', changelog: '', breaking: false, schema: {} }],
      },
    }))

    await runValidate({})

    expect(process.exitCode).toBeUndefined()
    expect(logs.some((l) => l.includes('validated'))).toBe(true)
  })

  it('exits 1 when prompts are unsynced', async () => {
    vi.mocked(readRegistry).mockReturnValue(makeRegistry({
      'bad-prompt': {
        current: '2.0.0',
        history: [{ version: '1.0.0', createdAt: '', author: '', templateHash: '', schemaHash: '', model: '', changelog: '', breaking: false, schema: {} }],
      },
    }))

    await runValidate({})

    expect(process.exitCode).toBe(1)
    expect(logs.some((l) => l.includes('bad-prompt'))).toBe(true)
  })

  it('exits 0 for empty registry', async () => {
    vi.mocked(readRegistry).mockReturnValue(makeRegistry({}))

    await runValidate({})

    expect(process.exitCode).toBeUndefined()
    expect(logs.some((l) => l.includes('No prompts registered'))).toBe(true)
  })
})
