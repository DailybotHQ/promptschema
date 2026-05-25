import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { definePrompt } from '../../src/define-prompt.js'
import { LLMSchemaValidationError, LLMSchemaRunError } from '../../src/errors.js'

const validConfig = {
  name: 'order-assistant',
  version: '1.0.0',
  model: 'openai/gpt-4o',
  input: z.object({
    order: z.string(),
    lang: z.enum(['es', 'en']),
    total: z.number().positive(),
    discount: z.boolean().optional(),
  }),
  template: (i: { order: string; lang: string; total: number; discount?: boolean }) => `
    You are an e-commerce assistant.
    Order: ${i.order}
    Language: ${i.lang}
    ${i.total > 100 ? 'Offer 10% discount.' : ''}
  `,
}

describe('definePrompt()', () => {
  it('returns a PromptInstance with correct metadata', () => {
    const prompt = definePrompt(validConfig)
    expect(prompt.name).toBe('order-assistant')
    expect(prompt.version).toBe('1.0.0')
    expect(prompt.model).toBe('openai/gpt-4o')
  })

  it('metadata properties are readonly (frozen)', () => {
    const prompt = definePrompt(validConfig)
    expect(() => {
      'use strict'
      ;(prompt as Record<string, unknown>).name = 'hacked'
    }).toThrow()
    expect(prompt.name).toBe('order-assistant')
  })

  describe('config validation', () => {
    it('throws for empty name', () => {
      expect(() =>
        definePrompt({ ...validConfig, name: '' }),
      ).toThrow(LLMSchemaValidationError)
    })

    it('throws for non-kebab-case name', () => {
      expect(() =>
        definePrompt({ ...validConfig, name: 'OrderAssistant' }),
      ).toThrow(LLMSchemaValidationError)
    })

    it('throws for name with spaces', () => {
      expect(() =>
        definePrompt({ ...validConfig, name: 'order assistant' }),
      ).toThrow(LLMSchemaValidationError)
    })

    it('throws for invalid semver version', () => {
      expect(() =>
        definePrompt({ ...validConfig, version: 'v1.0' }),
      ).toThrow(LLMSchemaValidationError)
    })

    it('throws for model without provider prefix', () => {
      expect(() =>
        definePrompt({ ...validConfig, model: 'gpt-4o' }),
      ).toThrow(LLMSchemaValidationError)
    })

    it('reports multiple config issues at once', () => {
      try {
        definePrompt({ ...validConfig, name: '', version: 'bad', model: 'no-slash' })
        expect.fail('should have thrown')
      } catch (e) {
        const err = e as LLMSchemaValidationError
        expect(err.issues.length).toBe(3)
      }
    })

    it('accepts valid kebab-case names', () => {
      expect(() => definePrompt({ ...validConfig, name: 'a' })).not.toThrow()
      expect(() => definePrompt({ ...validConfig, name: 'order-assistant' })).not.toThrow()
      expect(() => definePrompt({ ...validConfig, name: 'my-long-prompt-name' })).not.toThrow()
      expect(() => definePrompt({ ...validConfig, name: 'prompt2' })).not.toThrow()
    })
  })

  describe('.validate()', () => {
    it('returns parsed data for valid input', () => {
      const prompt = definePrompt(validConfig)
      const result = prompt.validate({ order: 'Dress', lang: 'en', total: 100 })
      expect(result).toEqual({ order: 'Dress', lang: 'en', total: 100 })
    })

    it('throws LLMSchemaValidationError for invalid input', () => {
      const prompt = definePrompt(validConfig)
      expect(() =>
        prompt.validate({ order: 'Dress', lang: 'fr', total: -10 }),
      ).toThrow(LLMSchemaValidationError)
    })

    it('error includes the prompt name and version', () => {
      const prompt = definePrompt(validConfig)
      try {
        prompt.validate({})
        expect.fail('should have thrown')
      } catch (e) {
        const err = e as LLMSchemaValidationError
        expect(err.promptName).toBe('order-assistant')
        expect(err.promptVersion).toBe('1.0.0')
      }
    })
  })

  describe('.render()', () => {
    it('renders the template with valid input', () => {
      const prompt = definePrompt(validConfig)
      const result = prompt.render({ order: 'Dress #204', lang: 'es', total: 149 })
      expect(result).toContain('Order: Dress #204')
      expect(result).toContain('Language: es')
      expect(result).toContain('Offer 10% discount.')
    })

    it('renders conditional logic correctly (total <= 100)', () => {
      const prompt = definePrompt(validConfig)
      const result = prompt.render({ order: 'Hat', lang: 'en', total: 50 })
      expect(result).toContain('Order: Hat')
      expect(result).not.toContain('Offer 10% discount.')
    })

    it('trims leading and trailing whitespace', () => {
      const prompt = definePrompt(validConfig)
      const result = prompt.render({ order: 'X', lang: 'en', total: 10 })
      expect(result).not.toMatch(/^\s/)
      expect(result).not.toMatch(/\s$/)
    })

    it('throws LLMSchemaValidationError for invalid input', () => {
      const prompt = definePrompt(validConfig)
      expect(() =>
        prompt.render({ order: 'X', lang: 'fr', total: 10 } as never),
      ).toThrow(LLMSchemaValidationError)
    })
  })

  describe('.run()', () => {
    it('throws LLMSchemaRunError (placeholder)', async () => {
      const prompt = definePrompt(validConfig)
      await expect(
        prompt.run({ order: 'Dress', lang: 'en', total: 100 }),
      ).rejects.toThrow(LLMSchemaRunError)
    })

    it('validates input before throwing run error', async () => {
      const prompt = definePrompt(validConfig)
      await expect(
        prompt.run({ order: 'Dress', lang: 'fr', total: -1 } as never),
      ).rejects.toThrow(LLMSchemaValidationError)
    })
  })
})
