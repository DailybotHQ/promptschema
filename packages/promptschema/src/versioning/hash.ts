import { createHash } from 'node:crypto'
import type { ZodType } from 'zod'
import { schemaToJsonSchema } from '../schema.js'

function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex')
}

export function normalizeWhitespace(str: string): string {
  return str
    .split('\n')
    .map((line) => line.trim().replace(/[ \t]+/g, ' '))
    .join('\n')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

export function stableStringify(obj: unknown): string {
  return JSON.stringify(obj, (_, value) => {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      return Object.keys(value)
        .sort()
        .reduce<Record<string, unknown>>((sorted, key) => {
          sorted[key] = value[key]
          return sorted
        }, {})
    }
    return value
  })
}

export function hashTemplate(templateFn: (...args: unknown[]) => string): string {
  const source = normalizeWhitespace(templateFn.toString())
  return sha256(source).slice(0, 8)
}

export function hashSchema(schema: ZodType): string {
  const jsonSchema = schemaToJsonSchema(schema)
  const serialized = stableStringify(jsonSchema)
  return sha256(serialized).slice(0, 8)
}
