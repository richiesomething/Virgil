// Splits data-src/<id>/source/book.txt into chapters at a heading pattern, writes
// source/chapters/NNN.txt and word-counts.json, and prints each chapter's heading so the
// chapter list can be checked against the edition.
// Usage: node scripts/pipeline/split-text.mjs <id> "<regex for a chapter heading line>" [--skip-before "<regex>"]
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [id, pattern] = process.argv.slice(2)
const skipIdx = process.argv.indexOf('--skip-before')
const skipBefore = skipIdx > 0 ? new RegExp(process.argv[skipIdx + 1], 'm') : null
if (!id || !pattern) {
  console.error('Usage: node scripts/pipeline/split-text.mjs <id> "<heading regex>" [--skip-before "<regex>"]')
  process.exit(1)
}
const dir = join('data-src', id)
let text = readFileSync(join(dir, 'source', 'book.txt'), 'utf8')
if (skipBefore) {
  const m = text.search(skipBefore)
  if (m < 0) throw new Error('--skip-before pattern not found')
  text = text.slice(m)
}
const re = new RegExp(pattern, 'gm')
const starts = [...text.matchAll(re)].map((m) => ({ index: m.index, heading: m[0].trim() }))
if (!starts.length) throw new Error('No chapter headings matched')
rmSync(join(dir, 'source', 'chapters'), { recursive: true, force: true })
mkdirSync(join(dir, 'source', 'chapters'), { recursive: true })
const counts = []
starts.forEach((s, i) => {
  const body = text.slice(s.index, starts[i + 1]?.index ?? text.length).trim()
  const n = String(i + 1).padStart(3, '0')
  writeFileSync(join(dir, 'source', 'chapters', `${n}.txt`), body + '\n')
  const words = body.split(/\s+/).filter(Boolean).length
  counts.push(words)
  const titleLine = body.split('\n').slice(1).find((l) => l.trim())?.trim() ?? ''
  console.log(`${n}  ${words.toString().padStart(6)} words  ${s.heading}  ${titleLine.slice(0, 60)}`)
})
writeFileSync(join(dir, 'word-counts.json'), JSON.stringify(counts) + '\n')
console.log(`\n${starts.length} chapters → ${dir}/source/chapters/, word-counts.json`)
