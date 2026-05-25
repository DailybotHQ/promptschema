export interface ValidationIssue {
  field: string
  message: string
  received?: unknown
}

export class LLMSchemaError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LLMSchemaError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class LLMSchemaValidationError extends LLMSchemaError {
  public readonly issues: ValidationIssue[]
  public readonly promptName: string
  public readonly promptVersion: string

  constructor(promptName: string, promptVersion: string, issues: ValidationIssue[]) {
    const issueLines = issues
      .map((i) => {
        const receivedPart = i.received !== undefined ? `, received ${JSON.stringify(i.received)}` : ''
        return `  ✗ ${i.field}: ${i.message}${receivedPart}`
      })
      .join('\n')

    super(
      `input validation failed for prompt '${promptName}' v${promptVersion}\n${issueLines}`,
    )

    this.name = 'LLMSchemaValidationError'
    this.issues = issues
    this.promptName = promptName
    this.promptVersion = promptVersion
  }
}

export class LLMSchemaRunError extends LLMSchemaError {
  public readonly promptName: string
  public readonly model: string

  constructor(promptName: string, model: string, message: string, cause?: Error) {
    super(message)
    this.name = 'LLMSchemaRunError'
    this.promptName = promptName
    this.model = model
    if (cause) {
      this.cause = cause
    }
  }
}

export class LLMSchemaTimeoutError extends LLMSchemaRunError {
  public readonly timeoutMs: number

  constructor(promptName: string, model: string, timeoutMs: number) {
    super(promptName, model, `request timed out after ${timeoutMs}ms for prompt '${promptName}' using model '${model}'`)
    this.name = 'LLMSchemaTimeoutError'
    this.timeoutMs = timeoutMs
  }
}

export class LLMSchemaRateLimitError extends LLMSchemaRunError {
  public readonly retryAfterMs?: number

  constructor(promptName: string, model: string, retryAfterMs?: number) {
    const retryPart = retryAfterMs ? ` — retry after ${retryAfterMs}ms` : ''
    super(promptName, model, `rate limited by '${model}' for prompt '${promptName}'${retryPart}`)
    this.name = 'LLMSchemaRateLimitError'
    this.retryAfterMs = retryAfterMs
  }
}
