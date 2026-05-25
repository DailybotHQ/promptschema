import { it } from 'vitest'
import { definePrompt } from '../../src/index.js'
import { z } from 'zod'

export const TEST_TIMEOUT = 30_000
export const MAX_TOKENS = 50

export function skipIfNoEnv(varName: string) {
  return process.env[varName] ? it : it.skip
}

export function hasEnv(varName: string): boolean {
  return !!process.env[varName]
}

export function createTestPrompt(model: string) {
  return definePrompt({
    name: 'integration-test',
    version: '1.0.0',
    model,
    input: z.object({
      message: z.string(),
    }),
    template: (i) => i.message,
  })
}
