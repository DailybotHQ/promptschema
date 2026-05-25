import { describe, it, expect } from 'vitest'
import { estimateCost, PRICING } from '../../src/adapters/pricing.js'

describe('PRICING', () => {
  it('contains entries for all major providers', () => {
    const providers = new Set(Object.keys(PRICING).map((k) => k.split('/')[0]))
    expect(providers).toContain('openai')
    expect(providers).toContain('anthropic')
    expect(providers).toContain('gemini')
  })

  it('every entry has positive input and output rates', () => {
    for (const [model, rates] of Object.entries(PRICING)) {
      expect(rates.input, `${model} input`).toBeGreaterThan(0)
      expect(rates.output, `${model} output`).toBeGreaterThan(0)
    }
  })
})

describe('estimateCost', () => {
  it('calculates cost for a known model', () => {
    const cost = estimateCost('openai/gpt-4o', 1000, 500)
    const expected = 1000 * PRICING['openai/gpt-4o'].input + 500 * PRICING['openai/gpt-4o'].output
    expect(cost).toBeCloseTo(expected)
  })

  it('returns 0 for an unknown model', () => {
    expect(estimateCost('unknown/model', 1000, 500)).toBe(0)
  })

  it('returns 0 when tokens are 0', () => {
    expect(estimateCost('openai/gpt-4o', 0, 0)).toBe(0)
  })
})
