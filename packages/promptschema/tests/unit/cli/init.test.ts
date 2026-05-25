import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { existsSync } from 'node:fs'
import { runInit } from '../../../src/cli/commands/init.js'
import * as registryModule from '../../../src/versioning/registry.js'

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
  return { ...actual, existsSync: vi.fn() }
})

vi.mock('../../../src/versioning/registry.js', async () => {
  const actual = await vi.importActual<typeof import('../../../src/versioning/registry.js')>('../../../src/versioning/registry.js')
  return { ...actual, writeRegistry: vi.fn() }
})

describe('runInit', () => {
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

  it('creates registry when none exists', async () => {
    vi.mocked(existsSync).mockReturnValue(false)

    await runInit({})

    expect(registryModule.writeRegistry).toHaveBeenCalled()
    expect(logs.some((l) => l.includes('Registry created'))).toBe(true)
  })

  it('warns when registry already exists', async () => {
    vi.mocked(existsSync).mockReturnValue(true)

    await runInit({})

    expect(registryModule.writeRegistry).not.toHaveBeenCalled()
    expect(logs.some((l) => l.includes('already exists'))).toBe(true)
  })
})
