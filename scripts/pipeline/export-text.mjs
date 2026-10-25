// Turns a public-domain book's split text (data-src/<id>/source/chapters/NNN.txt, not committed)
// into the chapter files the reader fetches: public/texts/<id>/NNN.txt plus manifest.json.
// Each file is one paragraph per line with blank lines between, no heading, no footnotes.
// Also rewrites word-counts.json from the cleaned text unless --keep-counts is given.
// Usage: node scripts/pipeline/export-text.mjs <id> [--keep-counts]
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [id] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const keepCounts = process.argv.includes('--keep-counts')
if (!id) {
  console.error('Usage: node scripts/pipeline/export-text.mjs <id> [--keep-counts]')
  process.exit(1)
}
const dir = join('data-src', id)
const src = join(dir, 'source', 'chapters')
if (!existsSync(src)) {
  console.error(`${src} not found: run split-text.mjs first`)
  process.exit(1)
}
const book = JSON.parse(readFileSync(join(dir, 'book.json'), 'utf8'))
const out = join('public', 'texts', id)
rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })

const files = readdirSync(src).filter((f) => /^\d{3}\.txt$/.test(f)).sort()
if (files.length !== book.chapterCount) {
  console.error(`${files.length} chapter files but book.json says ${book.chapterCount} chapters`)
  process.exit(1)
}

// Known chapter titles, so a title line that looks like a sentence ("At Random!") is still dropped.
const norm = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const titles = readdirSync(dir)
  .filter((f) => /^chapters-\d+-\d+\.json$/.test(f))
  .flatMap((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')))
  .reduce((m, c) => m.set(c.number, norm(c.title ?? '')), new Map())

const counts = []
const dropped = []
for (const f of files) {
  const title = titles.get(Number(f.slice(0, 3)))
  const raw = readFileSync(join(src, f), 'utf8').replace(/\r\n/g, '\n')
  let paragraphs = raw
    .split(/\n[ \t]*\n+/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map(clean)
    .filter((p) => !/^VOLUME [A-Z]+$/.test(p) && !/^\d+[a-z]?$/.test(p) && !/^FOOTNOTES:?$/.test(p)) // volume markers, illustration ids

  // Heading block: leading short lines that aren't sentences ("CHAPTER 1", "A Runaway Reef", "Chapter 1. The Arrival").
  const isHeading = (p) => p.length <= 80 && (!/[.!?…”’"')]$/.test(p) || (title && norm(p) === title))
  while (paragraphs.length > 1 && isHeading(paragraphs[0])) dropped.push(`${f}: ${paragraphs.shift()}`)
  // Gutenberg collects footnotes at the very end of the book.
  const firstNote = paragraphs.findIndex((p, i) => /^\[\d+\] /.test(p) && paragraphs.slice(i).every((q) => /^\[\d+\] /.test(q)))
  if (firstNote > 0) paragraphs = paragraphs.slice(0, firstNote)
  paragraphs = paragraphs.map((p) => p.replace(/\s*\[\d+\]/g, ''))

  writeFileSync(join(out, f), paragraphs.join('\n\n') + '\n')
  counts.push(paragraphs.join(' ').split(/\s+/).filter(Boolean).length)
}

const text = book.text ?? {}
writeFileSync(
  join(out, 'manifest.json'),
  JSON.stringify({ chapters: files.length, wordCounts: counts, edition: text.edition ?? book.edition, license: text.license ?? 'Public domain', sourceUrl: text.sourceUrl ?? book.sourceUrl ?? null }, null, 2) + '\n',
)
if (!keepCounts) writeFileSync(join(dir, 'word-counts.json'), JSON.stringify(counts) + '\n')

console.log(`✓ ${id}: ${files.length} chapters → ${out}/ (${counts.reduce((a, b) => a + b, 0).toLocaleString()} words)`)
console.log('Dropped heading lines (check these look like headings, not text):')
for (const d of dropped) console.log('  ' + d)

/** Plain prose: no underscore italics, em dashes for --, straight spacing. */
function clean(p) {
  return p
    .replace(/_([^_]+)_/g, '$1')
    .replace(/--/g, '—')
    .replace(/ +([,.;:!?])/g, '$1')
    .trim()
}
