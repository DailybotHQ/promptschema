import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { runHistory } from '../../../src/cli/commands/history.js'

vi.mock('../../../src/versioning/registry.js', () => ({
  readRegistry: vi.fn(),
  getPromptEntry: vi.fn(),
  DEFAULT_REGISTRY_PATH: 'promptschema.registry.json',
}))

import { readRegistry, getPromptEntry } from '../../../src/versioning/registry.js'

describe('runHistory', () => {
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

  it('shows version history', async () => {
    vi.mocked(readRegistry).mockReturnValue({ $schema: '', version: '1', prompts: {} })
    vi.mocked(getPromptEntry).mockReturnValue({
      current: '2.0.0',
      history: [
        {
          version: '2.0.0',
          createdAt: '2026-05-25T10:00:00.000Z',
          author: 'oscar',
          templateHash: 'abc',
          schemaHash: 'def',
          model: 'openai/gpt-4o',
          changelog: 'breaking change',
          breaking: true,
          schema: {},
        },
        {
          version: '1.0.0',
          createdAt: '2026-05-20T10:00:00.000Z',
          author: 'oscar',
          templateHash: 'xyz',
          schemaHash: 'uvw',
          model: 'openai/gpt-4o',
          changelog: 'initial version',
          breaking: false,
          schema: {},
        },
      ],
    })

    await runHistory(['my-prompt'], {})

    const output = logs.join('\n')
    expect(output).toContain('my-prompt')
    expect(output).toContain('v2.0.0')
    expect(output).toContain('v1.0.0')
    expect(output).toContain('breaking')
    expect(output).toContain('2026-05-25')
  })

  it('shows empty history message', async () => {
    vi.mocked(readRegistry).mockReturnValue({ $schema: '', version: '1', prompts: {} })
    vi.mocked(getPromptEntry).mockReturnValue({ current: '1.0.0', history: [] })

    await runHistory(['my-prompt'], {})

    expect(logs.some((l) => l.includes('No version history'))).toBe(true)
  })

  it('errors when no name provided', async () => {
    await runHistory([], {})

    expect(process.exitCode).toBe(1)
    expect(errors.some((l) => l.includes('Missing prompt name'))).toBe(true)
  })

  it('errors when prompt not found', async () => {
    vi.mocked(readRegistry).mockReturnValue({ $schema: '', version: '1', prompts: {} })
    vi.mocked(getPromptEntry).mockReturnValue(undefined)

    await runHistory(['unknown'], {})

    expect(process.exitCode).toBe(1)
    expect(errors.some((l) => l.includes('not found'))).toBe(true)
  })
})
