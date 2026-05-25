export function supportsColor(): boolean {
  if (process.env.NO_COLOR !== undefined) return false
  if (process.env.FORCE_COLOR !== undefined) return true
  return Boolean(process.stdout.isTTY)
}

function wrap(code: string, text: string): string {
  return supportsColor() ? `\x1b[${code}m${text}\x1b[0m` : text
}

export const green = (t: string) => wrap('32', t)
export const red = (t: string) => wrap('31', t)
export const yellow = (t: string) => wrap('33', t)
export const cyan = (t: string) => wrap('36', t)
export const bold = (t: string) => wrap('1', t)
export const dim = (t: string) => wrap('2', t)

export const CHECK = '✔'
export const CROSS = '✗'
export const WARN = '⚠'
export const ARROW = '→'
export const BULLET = '•'

export function divider(length = 60): string {
  return '─'.repeat(length)
}

export function table(headers: string[], rows: string[][]): string {
  const colWidths = headers.map((h, i) => {
    const maxData = rows.reduce((max, row) => Math.max(max, (row[i] ?? '').length), 0)
    return Math.max(h.length, maxData)
  })

  const pad = (s: string, w: number) => s + ' '.repeat(Math.max(0, w - s.length))

  const headerLine = headers.map((h, i) => pad(h, colWidths[i])).join('  ')
  const separator = divider(headerLine.length)
  const dataLines = rows.map((row) =>
    row.map((cell, i) => pad(cell, colWidths[i])).join('  '),
  )

  return [headerLine, separator, ...dataLines].join('\n')
}
