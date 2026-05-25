import { type ZodType, type ZodIssue, z } from 'zod'
import { zodToJsonSchema, type JsonSchema7Type } from 'zod-to-json-schema'
import { LLMSchemaValidationError, type ValidationIssue } from './errors.js'

export { z }

function zodIssueToValidationIssue(issue: ZodIssue): ValidationIssue {
  const field = issue.path.length > 0 ? issue.path.join('.') : '(root)'

  const result: ValidationIssue = {
    field,
    message: issue.message,
  }

  if ('received' in issue && issue.received !== undefined) {
    result.received = issue.received
  }

  return result
}

export function validateInput<T>(
  schema: ZodType<T>,
  input: unknown,
  promptName: string,
  promptVersion: string,
): T {
  const result = schema.safeParse(input)

  if (result.success) {
    return result.data
  }

  const issues = result.error.issues.map(zodIssueToValidationIssue)
  throw new LLMSchemaValidationError(promptName, promptVersion, issues)
}

export function schemaToJsonSchema(schema: ZodType): JsonSchema7Type {
  const full = zodToJsonSchema(schema, { target: 'jsonSchema7' }) as Record<string, unknown>

  const { $schema: _, definitions: __, ...rest } = full
  return rest as JsonSchema7Type
}
