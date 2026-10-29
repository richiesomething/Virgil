// Takes authored illustration entries for one book and makes them live: converts the source plates to WebP under
// public/texts/<book>/img/, fills in width/height, merges them into public/texts/<book>/illustrations.json (replacing
// that chapter's earlier entries) and validates. Entries come as <dir>/NNN.json: { "items": [ { chapter, source, from, to?, after?, caption } ] }
// where `source` names a plate file in <plates> without extension (e.g. V1-D171).
// Usage: node scripts/illustrations/ingest.mjs <book> <entries-dir> <plates-dir> [NNN ...]
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [book, dir, plates, ...only] = process.argv.slice(2)
if (!book || !dir || !plates) {
  console.error('Usage: node scripts/illustrations/ingest.mjs <book> <entries-dir> <plates-dir> [NNN ...]')
  process.exit(1)
}
const textDir = join('public', 'texts', book)
const imgDir = join(textDir, 'img')
mkdirSync(imgDir, { recursive: true })
const manifestPath = join(textDir, 'illustrations.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))

const fold = (x) => x.toLowerCase().replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim()
const files = readdirSync(dir).filter((f) => /^\d{3}\.json$/.test(f)).sort()
const wanted = only.length ? new Set(only.map((x) => String(x).padStart(3, '0'))) : null
const done = []
for (const f of files) {
  const nnn = f.slice(0, 3)
  if (wanted && !wanted.has(nnn)) continue
  const chapter = Number(nnn)
  const entries = JSON.parse(readFileSync(join(dir, f), 'utf8')).items ?? []
  const paras = readFileSync(join(textDir, `${nnn}.txt`), 'utf8').split(/\n+/).filter((l) => l.trim()).map(fold)
  const find = (phrase, start = 0) => paras.findIndex((p, i) => i >= start && p.includes(fold(phrase)))
  const items = []
  let k = 0
  for (const e of entries) {
    const problems = []
    const from = find(e.from ?? '')
    if (from < 0) problems.push(`“from” not found: ${e.from}`)
    const to = from < 0 ? -1 : e.to ? find(e.to, from) : from
    if (from >= 0 && to < 0) problems.push(`“to” not found after from: ${e.to}`)
    if (from >= 0 && to >= 0 && to - from > 60) problems.push(`passage spans ${to - from} paragraphs`)
    if (e.after && from >= 0 && find(e.after, from) < 0) problems.push(`“after” not found: ${e.after}`)
    const src = join(plates, `${e.source}.jpg`)
    if (!existsSync(src)) problems.push(`plate missing: ${src}`)
    if (!e.caption) problems.push('no caption')
    if (problems.length) {
      console.log(`✗ ${nnn} ${e.source}: ${problems.join('; ')}`)
      continue
    }
    k++
    const file = `${nnn}-${k}.webp`
    const out = join(imgDir, file)
    if (!existsSync(out)) execFileSync('convert', [src, '-colorspace', 'Gray', '-resize', '1000x1000>', '-level', '4%,97%', '-strip', '-quality', '72', '-define', 'webp:method=6', out])
    const [w, h] = execFileSync('identify', ['-format', '%w %h', out]).toString().trim().split(' ').map(Number)
    const item = { chapter, from: e.from, file, width: w, height: h, caption: e.caption, source: e.source }
    if (e.to) item.to = e.to
    if (e.after) item.after = e.after
    items.push(item)
  }
  manifest.items = [...manifest.items.filter((it) => it.chapter !== chapter), ...items].sort((a, b) => a.chapter - b.chapter || a.file.localeCompare(b.file))
  console.log(`✓ ${nnn}: ${items.length} of ${entries.length} entries`)
  done.push(nnn)
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
console.log(`chapters: ${done.join(' ') || 'none'}; ${manifest.items.length} illustrations in all`)
