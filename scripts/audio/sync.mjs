// Aligns a chapter's recognised words (scripts/audio/asr.py) to the exact tokens the reader shows,
// and writes public/texts/<book>/sync/NNN.json: a start time per token, so the reader can follow the
// narration word by word. Tokens the recogniser missed are placed between their timed neighbours.
// Usage: node scripts/audio/sync.mjs <book> <asr-dir> [n ...]   (no n: every chapter with ASR output)
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tokenize } from '../../src/lib/rsvp.ts'
import { splitParagraphs } from '../../src/lib/import/paragraphs.ts'

const [book, asrDir, ...only] = process.argv.slice(2)
if (!book || !asrDir) {
  console.error('Usage: node scripts/audio/sync.mjs <book> <asr-dir> [n ...]')
  process.exit(1)
}
const textDir = join('public', 'texts', book)
const outDir = join(textDir, 'sync')
mkdirSync(outDir, { recursive: true })

import { alignTokens } from './align.mjs'

const files = readdirSync(asrDir).filter((f) => /^\d{3}\.json$/.test(f)).sort()
const wanted = only.length ? new Set(only.map((x) => String(x).padStart(3, '0'))) : null
const report = []
for (const f of files) {
  const nnn = f.slice(0, 3)
  if (wanted && !wanted.has(nnn)) continue
  const asr = JSON.parse(readFileSync(join(asrDir, f), 'utf8'))
  const text = readFileSync(join(textDir, `${nnn}.txt`), 'utf8')
  const { tokens } = tokenize(splitParagraphs(text))
  const { times, quality } = alignTokens(tokens, asr.words, asr.duration)
  if (!quality.some((q) => q)) {
    report.push({ chapter: Number(nnn), matched: 0, note: 'no match' })
    continue
  }
  // Quality: how many tokens the recogniser confirmed, and the longest stretch it didn't.
  let matched = 0
  let run = 0
  let worst = 0
  for (let t = 0; t < tokens.length; t++) {
    if (quality[t]) ((matched++), (run = 0))
    else worst = Math.max(worst, ++run)
  }
  const ms = times.map((t) => Math.round(t * 1000))
  const deltas = ms.map((v, i) => (i ? v - ms[i - 1] : v))
  writeFileSync(join(outDir, `${nnn}.json`), JSON.stringify({ duration: asr.duration, start: ms[0], end: Math.round(Math.min(asr.duration, times[times.length - 1] + 1) * 1000), d: deltas }))
  report.push({ chapter: Number(nnn), tokens: tokens.length, matched: +(matched / tokens.length).toFixed(3), worstGap: worst, start: +(times[0]).toFixed(1), duration: asr.duration })
}
// audio.json: what the app needs up front (durations for the time left in the book, and which chapters have timings).
const book_ = JSON.parse(readFileSync(join('data-src', book, 'book.json'), 'utf8'))
const manifestPath = join(textDir, 'audio.json')
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { durations: new Array(book_.chapterCount).fill(null) }
for (const r of report) if (r.duration) manifest.durations[r.chapter - 1] = r.duration
manifest.synced = manifest.durations.filter((d) => d !== null).length
manifest.reader = book_.audio?.reader
manifest.license = book_.audio?.license
writeFileSync(manifestPath, JSON.stringify(manifest) + '\n')

for (const r of report) console.log(JSON.stringify(r))
const bad = report.filter((r) => r.matched < 0.85 || r.worstGap > 80)
console.log(`${report.length} chapters synced; ${bad.length} to check: ${bad.map((r) => r.chapter).join(', ') || 'none'}`)
