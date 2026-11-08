// Aligns a narration whose files don't match chapters one to one (LibriVox group recordings: several short chapters in
// one file, a long chapter split over several). Files that share chapters are aligned together on one timeline, then
// each chapter gets its own sync file naming the files it spans and where each starts on its timeline.
//
// Usage: node scripts/audio/sync-multi.mjs <book> <audio-map.json> <asr-root>
//   audio-map.json: [{ item, file, chapters: [n…], length }] in playing order (see docs/reading-spec.md §6)
//   asr-root/<item>/<NN>.json: scripts/audio/asr.py output per file (NN = the two-digit number in the file name)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tokenize } from '../../src/lib/rsvp.ts'
import { splitParagraphs } from '../../src/lib/import/paragraphs.ts'
import { alignTokens } from './align.mjs'

const [book, mapFile, asrRoot] = process.argv.slice(2)
if (!book || !mapFile || !asrRoot) {
  console.error('Usage: node scripts/audio/sync-multi.mjs <book> <audio-map.json> <asr-root>')
  process.exit(1)
}
const textDir = join('public', 'texts', book)
const outDir = join(textDir, 'sync')
mkdirSync(outDir, { recursive: true })
const map = JSON.parse(readFileSync(mapFile, 'utf8')).filter((f) => f.chapters?.length)

// Groups: files connected through shared chapters (a chapter split over files joins them; a file with several chapters holds them).
const groups = []
for (const f of map) {
  const hit = groups.find((g) => g.chapters.some((c) => f.chapters.includes(c)))
  if (hit) ((hit.files.push(f)), (hit.chapters = [...new Set([...hit.chapters, ...f.chapters])].sort((a, b) => a - b)))
  else groups.push({ files: [f], chapters: [...f.chapters].sort((a, b) => a - b) })
}
const asrPath = (f) => join(asrRoot, f.asr ?? `${f.item}/${/_(\d{2})_/.exec(f.file)?.[1]}.json`)

const report = []
const durations = []
for (const g of groups) {
  const asrs = g.files.map((f) => (existsSync(asrPath(f)) ? JSON.parse(readFileSync(asrPath(f), 'utf8')) : null))
  if (asrs.some((a) => !a)) {
    console.log(`… skipping ${g.files.map((f) => f.file).join(', ')}: ASR not done`)
    continue
  }
  // One timeline: words of each file shifted by the files before it.
  const offsets = []
  let t0 = 0
  const words = []
  asrs.forEach((a, i) => {
    offsets.push(t0)
    for (const [w, s, e] of a.words) words.push([w, s + t0, e + t0])
    t0 += a.duration
  })
  // The chapters' tokens in order, remembering where each chapter starts.
  const tokens = []
  const starts = []
  for (const n of g.chapters) {
    const text = readFileSync(join(textDir, `${String(n).padStart(3, '0')}.txt`), 'utf8')
    starts.push(tokens.length)
    tokens.push(...tokenize(splitParagraphs(text)).tokens)
  }
  const { times, quality } = alignTokens(tokens, words, t0)
  g.chapters.forEach((n, ci) => {
    const a = starts[ci]
    const b = starts[ci + 1] ?? tokens.length
    const ch = times.slice(a, b)
    const q = quality.slice(a, b)
    // The files this chapter actually plays through: from the one holding its first word to the one holding its last.
    const fileAt = (t) => Math.max(0, offsets.findLastIndex((o) => o <= t))
    const first = fileAt(ch[0])
    const last = fileAt(ch[ch.length - 1])
    const base = offsets[first]
    const files = g.files.slice(first, last + 1).map((f) => `${f.item}/${f.file}`)
    const offs = offsets.slice(first, last + 1).map((o) => o - base)
    const duration = (offsets[last + 1] ?? t0) - base
    const ms = ch.map((t) => Math.round((t - base) * 1000))
    const deltas = ms.map((v, i) => (i ? v - ms[i - 1] : v))
    const end = Math.min(duration, (ch[ch.length - 1] - base) + 1)
    writeFileSync(join(outDir, `${String(n).padStart(3, '0')}.json`), JSON.stringify({ duration, start: ms[0], end: Math.round(end * 1000), d: deltas, files, offsets: offs }))
    let matched = 0
    let run = 0
    let worst = 0
    for (const x of q) x ? ((matched++), (run = 0)) : (worst = Math.max(worst, ++run))
    durations[n - 1] = +(end - ms[0] / 1000).toFixed(2)
    report.push({ chapter: n, tokens: ch.length, matched: +(matched / ch.length).toFixed(3), worstGap: worst, files: files.length, minutes: +(durations[n - 1] / 60).toFixed(1) })
  })
}
const book_ = JSON.parse(readFileSync(join('data-src', book, 'book.json'), 'utf8'))
const manifestPath = join(textDir, 'audio.json')
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { durations: new Array(book_.chapterCount).fill(null) }
for (let i = 0; i < durations.length; i++) if (durations[i] != null) manifest.durations[i] = durations[i]
manifest.synced = manifest.durations.filter((d) => d != null).length
manifest.reader = book_.audio?.reader
manifest.license = book_.audio?.license
writeFileSync(manifestPath, JSON.stringify(manifest) + '\n')
for (const r of report) console.log(JSON.stringify(r))
const bad = report.filter((r) => r.matched < 0.85 || r.worstGap > 80)
console.log(`${report.length} chapters synced (${manifest.synced} in all); ${bad.length} to check: ${bad.map((r) => r.chapter).join(', ') || 'none'}`)
