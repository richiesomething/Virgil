// Splits a Standard Ebooks single-page XHTML (or any EPUB-style XHTML with <section epub:type="… chapter …">)
// into data-src/<id>/source/chapters/NNN.txt, one paragraph per blank-line block, headings and endnote
// markers removed. Then run export-text.mjs. Usage: node scripts/pipeline/split-xhtml.mjs <id> <file.xhtml>
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [id, file] = process.argv.slice(2)
if (!id || !file) {
  console.error('Usage: node scripts/pipeline/split-xhtml.mjs <id> <file.xhtml>')
  process.exit(1)
}
const html = readFileSync(file, 'utf8')
const sections = [...html.matchAll(/<section\b[^>]*epub:type="[^"]*\bchapter\b[^"]*"[^>]*>([\s\S]*?)<\/section>/g)].map((m) => m[1])
if (!sections.length) throw new Error('No <section epub:type="chapter"> found')

const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', mdash: '—', ndash: '–' }
const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (entities[e] ?? m)))

const dir = join('data-src', id, 'source', 'chapters')
rmSync(dir, { recursive: true, force: true })
mkdirSync(dir, { recursive: true })
const counts = []
sections.forEach((body, i) => {
  const heading = (body.match(/<hgroup>[\s\S]*?<\/hgroup>|<h2\b[\s\S]*?<\/h2>/) ?? [''])[0]
  const title = decode(heading.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
  const text = decode(
    body
      .replace(/<hgroup>[\s\S]*?<\/hgroup>|<h[1-6]\b[\s\S]*?<\/h[1-6]>/g, '')
      .replace(/<a\b[^>]*epub:type="noteref"[^>]*>[\s\S]*?<\/a>/g, '')
      .replace(/<br\s*\/?>/g, ' ')
      .replace(/<\/(p|li|td|th|tr|div|blockquote|figcaption|dd|dt)>/g, '\n\n')
      .replace(/<[^>]+>/g, ''),
  )
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/[\u2060\u200b\u00ad]/g, '').replace(/\s+/g, ' ').trim()) // word joiners, zero-width spaces, soft hyphens
    .filter(Boolean)
  const n = String(i + 1).padStart(3, '0')
  writeFileSync(join(dir, `${n}.txt`), paragraphs.join('\n\n') + '\n')
  const words = paragraphs.join(' ').split(/\s+/).filter(Boolean).length
  counts.push(words)
  console.log(`${n}  ${String(words).padStart(6)} words  ${title.slice(0, 70)}`)
})
writeFileSync(join('data-src', id, 'word-counts.json'), JSON.stringify(counts) + '\n')
console.log(`\n${sections.length} chapters → ${dir}/`)
