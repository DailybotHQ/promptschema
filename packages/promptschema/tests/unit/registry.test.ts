import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  createEmptyRegistry,
  readRegistry,
  writeRegistry,
  getPromptEntry,
  getHistoryEntry,
} from '../../src/versioning/registry.js'
import { REGISTRY_SCHEMA_URL } from '../../src/versioning/registry.js'
import { LLMSchemaError } from '../../src/errors.js'
import type { Registry } from '../../src/versioning/registry-types.js'

const TEST_DIR = join(import.meta.dirname, '..', '..', 'tmp-test-registry')
const TEST_FILE = join(TEST_DIR, 'test-registry.json')

beforeEach(() => {
  if (!existsSync(TEST_DIR)) mkdirSync(TEST_DIR, { recursive: true })
})

afterEach(() => {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true })
})

describe('createEmptyRegistry', () => {
  it('returns valid structure with $schema and version', () => {
    const reg = createEmptyRegistry()
    expect(reg.$schema).toBe(REGISTRY_SCHEMA_URL)
    expect(reg.version).toBe('1')
    expect(reg.prompts).toEqual({})
  })
})

describe('readRegistry', () => {
  it('returns empty registry when file does not exist', () => {
    const reg = readRegistry(join(TEST_DIR, 'nonexistent.json'))
    expect(reg.prompts).toEqual({})
    expect(reg.version).toBe('1')
  })

  it('parses a valid registry file', () => {
    const data: Registry = {
      $schema: REGISTRY_SCHEMA_URL,
      version: '1',
      prompts: {
        'test-prompt': {
          current: '1.0.0',
          history: [
            {
              version: '1.0.0',
              createdAt: '2026-01-01T00:00:00Z',
              author: 'oscar',
              templateHash: 'abcd1234',
              schemaHash: 'efgh5678',
              model: 'openai/gpt-4o',
              changelog: 'initial',
              breaking: false,
              schema: { type: 'object' },
            },
          ],
        },
      },
    }
    writeFileSync(TEST_FILE, JSON.stringify(data), 'utf8')

    const reg = readRegistry(TEST_FILE)
    expect(reg.prompts['test-prompt']?.current).toBe('1.0.0')
    expect(reg.prompts['test-prompt']?.history).toHaveLength(1)
  })

  it('throws for malformed JSON', () => {
    writeFileSync(TEST_FILE, '{ invalid json }}}', 'utf8')
    expect(() => readRegistry(TEST_FILE)).toThrow(LLMSchemaError)
    expect(() => readRegistry(TEST_FILE)).toThrow('invalid JSON')
  })
})

describe('writeRegistry', () => {
  it('roundtrip preserves all data', () => {
    const original = createEmptyRegistry()
    original.prompts['my-prompt'] = {
      current: '2.0.0',
      history: [
        {
          version: '2.0.0',
          createdAt: '2026-05-25T00:00:00Z',
          author: 'oscar',
          templateHash: '11112222',
          schemaHash: '33334444',
          model: 'anthropic/claude-sonnet-4-6',
          changelog: 'breaking change',
          breaking: true,
          schema: { type: 'object', properties: { name: { type: 'string' } } },
        },
      ],
    }

    writeRegistry(TEST_FILE, original)
    const loaded = readRegistry(TEST_FILE)

    expect(loaded).toEqual(original)
  })
})

describe('getPromptEntry', () => {
  it('returns the entry if it exists', () => {
    const reg = createEmptyRegistry()
    reg.prompts['my-prompt'] = { current: '1.0.0', history: [] }
    expect(getPromptEntry(reg, 'my-prompt')).toEqual({ current: '1.0.0', history: [] })
  })

  it('returns undefined if not found', () => {
    const reg = createEmptyRegistry()
    expect(getPromptEntry(reg, 'nope')).toBeUndefined()
  })
})

describe('getHistoryEntry', () => {
  it('returns the matching version', () => {
    const reg = createEmptyRegistry()
    reg.prompts['p'] = {
      current: '2.0.0',
      history: [
        { version: '2.0.0', createdAt: '', author: '', templateHash: '', schemaHash: '', model: '', changelog: '', breaking: false, schema: {} },
        { version: '1.0.0', createdAt: '', author: '', templateHash: '', schemaHash: '', model: '', changelog: '', breaking: false, schema: {} },
      ],
    }
    expect(getHistoryEntry(reg, 'p', '1.0.0')?.version).toBe('1.0.0')
  })

  it('returns undefined for missing prompt', () => {
    expect(getHistoryEntry(createEmptyRegistry(), 'nope', '1.0.0')).toBeUndefined()
  })

  it('returns undefined for missing version', () => {
    const reg = createEmptyRegistry()
    reg.prompts['p'] = { current: '1.0.0', history: [] }
    expect(getHistoryEntry(reg, 'p', '9.9.9')).toBeUndefined()
  })
})
