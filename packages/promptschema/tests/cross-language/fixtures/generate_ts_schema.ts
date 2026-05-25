import { z } from 'zod'
import { schemaToJsonSchema } from '../../../packages/promptschema/src/schema.js'

const OrderInput = z.object({
  order: z.string(),
  lang: z.enum(['es', 'en']),
  total: z.number(),
  discount: z.boolean().default(false),
})

const schema = schemaToJsonSchema(OrderInput)

const sorted = JSON.parse(JSON.stringify(schema, Object.keys(schema).sort(), 2))
console.log(JSON.stringify(sorted, null, 2))
