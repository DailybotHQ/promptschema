import { runInit } from './commands/init.js'
import { runList } from './commands/list.js'
import { runStatus } from './commands/status.js'
import { runValidate } from './commands/validate.js'
import { runBump } from './commands/bump.js'
import { runDiff } from './commands/diff.js'
import { runHistory } from './commands/history.js'

export interface ParsedArgs {
  command: string
  args: string[]
  flags: Record<string, boolean | string>
}

export function parseArgs(argv: string[]): ParsedArgs {
  const raw = argv.slice(2)
  const args: string[] = []
  const flags: Record<string, boolean | string> = {}
  let command = ''

  for (const token of raw) {
    if (token.startsWith('--')) {
      const key = token.slice(2)
      const eqIdx = key.indexOf('=')
      if (eqIdx !== -1) {
        flags[key.slice(0, eqIdx)] = key.slice(eqIdx + 1)
      } else {
        flags[key] = true
      }
    } else if (!command) {
      command = token
    } else {
      args.push(token)
    }
  }

  return { command, args, flags }
}

const HELP = `
promptschema — typed, versioned prompts for LLMs

Usage:
  promptschema <command> [options]

Commands:
  init                         Create promptschema.registry.json
  status                       Show sync state of all prompts
  validate                     CI gate — exit 1 if prompts are unsynced
  list                         List all registered prompts
  bump <name> [--patch|--minor|--major]  Bump a prompt version
  diff <name> <v1> <v2>        Show diff between two versions
  history <name>               Show version history of a prompt

Options:
  --help       Show this help message
  --version    Show package version
`.trim()

const COMMANDS: Record<string, (args: string[], flags: Record<string, boolean | string>) => Promise<void>> = {
  init: (a, f) => runInit(f),
  status: (a, f) => runStatus(f),
  validate: (a, f) => runValidate(f),
  list: (a, f) => runList(f),
  bump: (a, f) => runBump(a, f),
  diff: (a, f) => runDiff(a, f),
  history: (a, f) => runHistory(a, f),
}

export async function main(argv: string[] = process.argv): Promise<void> {
  const { command, args, flags } = parseArgs(argv)

  if (flags.version) {
    console.log('0.1.0')
    return
  }

  if (!command || flags.help) {
    console.log(HELP)
    return
  }

  const handler = COMMANDS[command]
  if (!handler) {
    console.error(`Unknown command: ${command}\n`)
    console.log(HELP)
    process.exitCode = 1
    return
  }

  try {
    await handler(args, flags)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`Error: ${message}`)
    process.exitCode = 1
  }
}

main()
