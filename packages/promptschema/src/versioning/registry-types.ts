export interface RegistryHistoryEntry {
  version: string
  createdAt: string
  author: string
  templateHash: string
  schemaHash: string
  model: string
  changelog: string
  breaking: boolean
  schema: Record<string, unknown>
}

export interface RegistryPromptEntry {
  current: string
  history: RegistryHistoryEntry[]
}

export interface Registry {
  $schema: string
  version: string
  prompts: Record<string, RegistryPromptEntry>
}

export type BumpType = 'patch' | 'minor' | 'major'

export interface ChangeDetail {
  templateChanged: boolean
  schemaChanged: boolean
  modelChanged: boolean
  fieldsAdded: string[]
  fieldsRemoved: string[]
  fieldsTypeChanged: string[]
  suggestedBump: BumpType | null
}
