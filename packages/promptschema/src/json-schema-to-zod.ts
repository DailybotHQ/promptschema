import { z, type ZodType } from 'zod'
import { LLMSchemaError } from './errors.js'

export function jsonSchemaToZod(schema: Record<string, unknown>): ZodType {
  const type = schema.type as string | undefined

  if (schema.enum) {
    const values = schema.enum as string[]
    if (values.length === 0) throw new LLMSchemaError('enum must have at least one value')
    return z.enum(values as [string, ...string[]])
  }

  if (!type) {
    throw new LLMSchemaError(`unsupported JSON Schema: missing "type" field`)
  }

  switch (type) {
    case 'string': {
      let s = z.string()
      if (typeof schema.minLength === 'number') s = s.min(schema.minLength)
      if (typeof schema.maxLength === 'number') s = s.max(schema.maxLength)
      return s
    }

    case 'number': {
      let n = z.number()
      if (typeof schema.minimum === 'number') n = n.min(schema.minimum)
      if (typeof schema.maximum === 'number') n = n.max(schema.maximum)
      if (typeof schema.exclusiveMinimum === 'number') n = n.gt(schema.exclusiveMinimum)
      if (typeof schema.exclusiveMaximum === 'number') n = n.lt(schema.exclusiveMaximum)
      return n
    }

    case 'integer': {
      let n = z.number().int()
      if (typeof schema.minimum === 'number') n = n.min(schema.minimum)
      if (typeof schema.maximum === 'number') n = n.max(schema.maximum)
      return n
    }

    case 'boolean':
      return z.boolean()

    case 'array': {
      const items = schema.items as Record<string, unknown> | undefined
      if (!items) return z.array(z.unknown())
      return z.array(jsonSchemaToZod(items))
    }

    case 'object': {
      const properties = (schema.properties || {}) as Record<string, Record<string, unknown>>
      const required = (schema.required || []) as string[]
      const shape: Record<string, ZodType> = {}

      for (const [key, propSchema] of Object.entries(properties)) {
        const zodProp = jsonSchemaToZod(propSchema)
        shape[key] = required.includes(key) ? zodProp : zodProp.optional()
      }

      let obj = z.object(shape)
      if (schema.additionalProperties === false) {
        obj = obj.strict()
      }
      return obj
    }

    default:
      throw new LLMSchemaError(`unsupported JSON Schema type: "${type}"`)
  }
}
