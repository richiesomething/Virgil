/** Plain text → paragraphs. Pure, so the parsers and tests can use it without the app. */
export function splitParagraphs(text: string): string[] {
  const t = text.replace(/\r\n?/g, '\n')
  const byBlank = t.split(/\n[ \t]*\n+/)
  const lines = t.split('\n').filter((l) => l.trim())
  // Hard-wrapped text has blank lines between paragraphs; text with one newline per paragraph has
  // long lines and almost no blank ones, so each line is a paragraph there.
  const longLines = lines.filter((l) => l.length > 120).length
  const parts = byBlank.length < lines.length / 20 && longLines > lines.length / 2 ? lines : byBlank
  return parts.map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean)
}
