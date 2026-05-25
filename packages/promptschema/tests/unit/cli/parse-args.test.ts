import { describe, it, expect } from 'vitest'
import { parseArgs } from '../../../src/cli/index.js'

describe('parseArgs', () => {
  it('parses a simple command', () => {
    const result = parseArgs(['node', 'cli', 'status'])
    expect(result).toEqual({ command: 'status', args: [], flags: {} })
  })

  it('parses command with positional args', () => {
    const result = parseArgs(['node', 'cli', 'diff', 'my-prompt', '1.0.0', '2.0.0'])
    expect(result).toEqual({
      command: 'diff',
      args: ['my-prompt', '1.0.0', '2.0.0'],
      flags: {},
    })
  })

  it('parses command with boolean flags', () => {
    const result = parseArgs(['node', 'cli', 'bump', 'my-prompt', '--major'])
    expect(result).toEqual({
      command: 'bump',
      args: ['my-prompt'],
      flags: { major: true },
    })
  })

  it('parses --key=value flags', () => {
    const result = parseArgs(['node', 'cli', 'init', '--path=custom.json'])
    expect(result).toEqual({
      command: 'init',
      args: [],
      flags: { path: 'custom.json' },
    })
  })

  it('parses multiple flags', () => {
    const result = parseArgs(['node', 'cli', 'bump', 'p', '--major', '--help'])
    expect(result).toEqual({
      command: 'bump',
      args: ['p'],
      flags: { major: true, help: true },
    })
  })

  it('returns empty command when no args', () => {
    const result = parseArgs(['node', 'cli'])
    expect(result).toEqual({ command: '', args: [], flags: {} })
  })

  it('handles --help alone', () => {
    const result = parseArgs(['node', 'cli', '--help'])
    expect(result).toEqual({ command: '', args: [], flags: { help: true } })
  })

  it('handles --version alone', () => {
    const result = parseArgs(['node', 'cli', '--version'])
    expect(result).toEqual({ command: '', args: [], flags: { version: true } })
  })
})
