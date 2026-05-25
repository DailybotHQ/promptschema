import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { runList } from '../../../src/cli/commands/list.js'
import type { Registry } from '../../../src/versioning/registry-types.js'

vi.mock('../../../src/versioning/registry.js', () => ({
  readRegistry: vi.fn(),
  DEFAULT_REGISTRY_PATH: 'promptschema.registry.json',
}))

import { readRegistry } from '../../../src/versioning/registry.js'

function makeRegistry(prompts: Registry['prompts']): Registry {
  return { $schema: '', version: '1', prompts }
}

describe('runList', () => {
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

  it('shows "no prompts" for empty registry', async () => {
    vi.mocked(readRegistry).mockReturnValue(makeRegistry({}))

    await runList({})

    expect(logs.some((l) => l.includes('No prompts registered'))).toBe(true)
  })

  it('renders table with prompts', async () => {
    vi.mocked(readRegistry).mockReturnValue(makeRegistry({
      'my-prompt': {
        current: '1.0.0',
        history: [{
          version: '1.0.0',
          createdAt: '2026-05-25T10:00:00.000Z',
          author: 'oscar',
          templateHash: 'abc',
          schemaHash: 'def',
          model: 'openai/gpt-4o',
          changelog: 'initial',
          breaking: false,
          schema: {},
        }],
      },
    }))

    await runList({})

    const output = logs.join('\n')
    expect(output).toContain('my-prompt')
    expect(output).toContain('v1.0.0')
    expect(output).toContain('openai/gpt-4o')
    expect(output).toContain('1 prompt registered')
  })

  it('shows count for multiple prompts', async () => {
    vi.mocked(readRegistry).mockReturnValue(makeRegistry({
      'prompt-a': { current: '1.0.0', history: [] },
      'prompt-b': { current: '2.0.0', history: [] },
    }))

    await runList({})

    expect(logs.some((l) => l.includes('2 prompts registered'))).toBe(true)
  })
})
