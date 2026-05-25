import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { runBump } from '../../../src/cli/commands/bump.js'
import type { Registry } from '../../../src/versioning/registry-types.js'

vi.mock('../../../src/versioning/registry.js', () => ({
  readRegistry: vi.fn(),
  writeRegistry: vi.fn(),
  getPromptEntry: vi.fn(),
  DEFAULT_REGISTRY_PATH: 'promptschema.registry.json',
}))

vi.mock('../../../src/versioning/bump.js', async () => {
  const actual = await vi.importActual<typeof import('../../../src/versioning/bump.js')>('../../../src/versioning/bump.js')
  return { ...actual }
})

import { readRegistry, writeRegistry, getPromptEntry } from '../../../src/versioning/registry.js'

const entry = {
  current: '1.0.0',
  history: [{
    version: '1.0.0',
    createdAt: '2026-01-01T00:00:00.000Z',
    author: 'oscar',
    templateHash: 'abc',
    schemaHash: 'def',
    model: 'openai/gpt-4o',
    changelog: 'initial',
    breaking: false,
    schema: {},
  }],
}

describe('runBump', () => {
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
    vi.mocked(readRegistry).mockReturnValue({ $schema: '', version: '1', prompts: { 'my-prompt': entry } })
    vi.mocked(getPromptEntry).mockReturnValue(entry)
  })

  afterEach(() => {
    process.exitCode = undefined as unknown as number
    vi.restoreAllMocks()
  })

  it('bumps with default patch type', async () => {
    await runBump(['my-prompt'], {})

    const output = logs.join('\n')
    expect(output).toContain('v1.0.0')
    expect(output).toContain('v1.0.1')
    expect(output).toContain('patch')
    expect(writeRegistry).toHaveBeenCalled()
  })

  it('bumps with --major flag', async () => {
    await runBump(['my-prompt'], { major: true })

    const output = logs.join('\n')
    expect(output).toContain('v2.0.0')
    expect(output).toContain('major')
  })

  it('bumps with --minor flag', async () => {
    await runBump(['my-prompt'], { minor: true })

    const output = logs.join('\n')
    expect(output).toContain('v1.1.0')
    expect(output).toContain('minor')
  })

  it('errors when no name provided', async () => {
    await runBump([], {})

    expect(process.exitCode).toBe(1)
    expect(errors.some((l) => l.includes('Missing prompt name'))).toBe(true)
  })

  it('errors when prompt not found', async () => {
    vi.mocked(getPromptEntry).mockReturnValue(undefined)

    await runBump(['unknown'], {})

    expect(process.exitCode).toBe(1)
    expect(errors.some((l) => l.includes('not found'))).toBe(true)
  })
})
