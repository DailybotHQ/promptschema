import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { schemaToJsonSchema } from '../../src/schema.js'
import { createEmptyRegistry } from '../../src/versioning/registry.js'
import { execSync } from 'node:child_process'
import { resolve } from 'node:path'

function hasPython(): boolean {
  try {
    execSync('python3 -c "import pydantic"', { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

const PYTHON_AVAILABLE = hasPython()
const itPython = PYTHON_AVAILABLE ? it : it.skip

function normalizeSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...schema }
  delete copy['$schema']
  delete copy['title']
  delete copy['description']
  delete copy['additionalProperties']

  if (copy.properties && typeof copy.properties === 'object') {
    const props = { ...(copy.properties as Record<string, Record<string, unknown>>) }
    for (const key of Object.keys(props)) {
      const prop = { ...props[key] }
      delete prop['title']
      delete prop['description']
      props[key] = prop
    }
    copy.properties = props
  }

  return JSON.parse(JSON.stringify(copy, Object.keys(copy).sort()))
}

describe('cross-language schema parity', () => {
  itPython('order-assistant produces compatible JSON Schema in TS and Python', () => {
    const OrderInput = z.object({
      order: z.string(),
      lang: z.enum(['es', 'en']),
      total: z.number(),
      discount: z.boolean().default(false),
    })

    const tsSchema = schemaToJsonSchema(OrderInput) as Record<string, unknown>
    const normalizedTS = normalizeSchema(tsSchema)

    const fixtureDir = resolve(__dirname, 'fixtures')
    const pythonOutput = execSync(`python3 ${fixtureDir}/generate_python_schema.py`, {
      encoding: 'utf-8',
    })
    const pySchema = JSON.parse(pythonOutput) as Record<string, unknown>
    const normalizedPY = normalizeSchema(pySchema)

    const tsProps = normalizedTS.properties as Record<string, unknown>
    const pyProps = normalizedPY.properties as Record<string, unknown>
    expect(Object.keys(tsProps).sort()).toEqual(Object.keys(pyProps).sort())

    for (const key of Object.keys(tsProps)) {
      const tsProp = tsProps[key] as Record<string, unknown>
      const pyProp = pyProps[key] as Record<string, unknown>
      expect(tsProp.type, `field '${key}' type mismatch`).toEqual(pyProp.type)
    }

    const tsRequired = ((normalizedTS.required as string[]) ?? []).sort()
    const pyRequired = ((normalizedPY.required as string[]) ?? []).sort()
    expect(tsRequired).toEqual(pyRequired)
  })

  itPython('both packages produce compatible empty registry', () => {
    const tsRegistry = createEmptyRegistry()

    const pythonOutput = execSync(
      `python3 -c "import json; from promptschema.versioning import create_empty_registry; print(json.dumps(create_empty_registry()))"`,
      { encoding: 'utf-8' },
    )
    const pyRegistry = JSON.parse(pythonOutput)

    expect(tsRegistry.version).toEqual(pyRegistry.version)
    expect(tsRegistry.prompts).toEqual(pyRegistry.prompts)
  })
})
