import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { supportsColor, green, red, table, divider } from '../../../src/cli/output.js'

describe('supportsColor', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('returns false when NO_COLOR is set', () => {
    process.env.NO_COLOR = '1'
    expect(supportsColor()).toBe(false)
  })

  it('returns true when FORCE_COLOR is set', () => {
    delete process.env.NO_COLOR
    process.env.FORCE_COLOR = '1'
    expect(supportsColor()).toBe(true)
  })
})

describe('color functions with NO_COLOR', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv, NO_COLOR: '1' }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('green returns plain text', () => {
    expect(green('ok')).toBe('ok')
  })

  it('red returns plain text', () => {
    expect(red('fail')).toBe('fail')
  })
})

describe('table', () => {
  it('renders aligned columns', () => {
    const output = table(['name', 'version'], [
      ['my-prompt', 'v1.0.0'],
      ['other', 'v2.0.0'],
    ])
    const lines = output.split('\n')
    expect(lines).toHaveLength(4)
    expect(lines[0]).toContain('name')
    expect(lines[0]).toContain('version')
    expect(lines[2]).toContain('my-prompt')
    expect(lines[2]).toContain('v1.0.0')
  })

  it('handles empty rows', () => {
    const output = table(['name', 'version'], [])
    const lines = output.split('\n')
    expect(lines).toHaveLength(2)
  })
})

describe('divider', () => {
  it('renders correct length', () => {
    expect(divider(10)).toBe('──────────')
    expect(divider(10)).toHaveLength(10)
  })
})
