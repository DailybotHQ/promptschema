export type {
  Registry,
  RegistryPromptEntry,
  RegistryHistoryEntry,
  BumpType,
  ChangeDetail,
} from './registry-types.js'

export type {
  PromptDiff,
  SchemaDiff,
  HistorySummary,
} from './diff.js'

export { hashTemplate, hashSchema } from './hash.js'

export {
  createEmptyRegistry,
  readRegistry,
  writeRegistry,
  getPromptEntry,
  getHistoryEntry,
  DEFAULT_REGISTRY_PATH,
} from './registry.js'

export { detectChanges } from './detect-changes.js'

export {
  incrementVersion,
  registerPrompt,
  bumpPrompt,
} from './bump.js'

export type { RegisterOptions, BumpOptions } from './bump.js'

export {
  diffPromptVersions,
  formatDiff,
} from './diff.js'
