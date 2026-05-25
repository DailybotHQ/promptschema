import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { runDiff } from '../../../src/cli/commands/diff.js'

vi.mock('../../../src/versioning/registry.js', () => ({
  readRegistry: vi.fn(),
  getPromptEntry: vi.fn(),
  DEFAULT_REGISTRY_PATH: 'promptschema.registry.json',
}))

vi.mock('../../../src/versioning/diff.js', () => ({
  diffPromptVersions: vi.fn(),
  formatDiff: vi.fn(),
}))

import { readRegistry, getPromptEntry } from '../../../src/versioning/registry.js'
import { diffPromptVersions, formatDiff } from '../../../src/versioning/diff.js'

describe('runDiff', () => {
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

  it('shows diff between two versions', async () => {
    const registry = { $schema: '', version: '1', prompts: {} }
    vi.mocked(readRegistry).mockReturnValue(registry)
    vi.mocked(getPromptEntry).mockReturnValue({ current: '2.0.0', history: [] })
    vi.mocked(diffPromptVersions).mockReturnValue({} as ReturnType<typeof diffPromptVersions>)
    vi.mocked(formatDiff).mockReturnValue('  diff output here')

    await runDiff(['my-prompt', '1.0.0', '2.0.0'], {})

    expect(diffPromptVersions).toHaveBeenCalledWith(registry, 'my-prompt', '1.0.0', '2.0.0')
    expect(logs.some((l) => l.includes('diff output here'))).toBe(true)
  })

  it('errors when missing arguments', async () => {
    await runDiff(['my-prompt', '1.0.0'], {})

    expect(process.exitCode).toBe(1)
    expect(errors.some((l) => l.includes('Missing arguments'))).toBe(true)
  })

  it('errors when prompt not found', async () => {
    vi.mocked(readRegistry).mockReturnValue({ $schema: '', version: '1', prompts: {} })
    vi.mocked(getPromptEntry).mockReturnValue(undefined)

    await runDiff(['unknown', '1.0.0', '2.0.0'], {})

    expect(process.exitCode).toBe(1)
    expect(errors.some((l) => l.includes('not found'))).toBe(true)
  })

  it('handles diff error gracefully', async () => {
    vi.mocked(readRegistry).mockReturnValue({ $schema: '', version: '1', prompts: {} })
    vi.mocked(getPromptEntry).mockReturnValue({ current: '1.0.0', history: [] })
    vi.mocked(diffPromptVersions).mockImplementation(() => {
      throw new Error('version 3.0.0 not found')
    })

    await runDiff(['my-prompt', '1.0.0', '3.0.0'], {})

    expect(process.exitCode).toBe(1)
    expect(errors.some((l) => l.includes('version 3.0.0 not found'))).toBe(true)
  })
})
