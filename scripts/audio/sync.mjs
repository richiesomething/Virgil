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

const norm = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')

/** Reader tokens expanded into the words a listener hears ("three-master" → three, master). */
function pieces(tokens) {
  const out = []
  tokens.forEach((t, i) => {
    for (const part of t.text.split(/[-—–‐]/)) {
      const w = norm(part)
      if (w) out.push({ w, token: i })
    }
    if (!norm(t.text)) out.push({ w: '', token: i }) // punctuation-only token: keeps its place
  })
  return out
}

function similar(a, b) {
  if (a === b) return 2
  if (!a || !b) return 0
  if (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a))) return 1
  if (Math.abs(a.length - b.length) > 2) return 0
  // one edit apart, for words of five letters or more
  if (a.length < 5) return 0
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  let j = 0
  while (j < a.length - i && j < b.length - i && a[a.length - 1 - j] === b[b.length - 1 - j]) j++
  return a.length - i - j <= 1 && b.length - i - j <= 1 ? 1 : 0
}

/** Global alignment (Needleman–Wunsch) of text pieces to recognised words. */
function align(ps, ws) {
  const n = ps.length
  const m = ws.length
  const GAP = -1
  // Scores in two rows; moves in a full byte matrix for the traceback.
  const moves = new Uint8Array((n + 1) * (m + 1)) // 1 diag, 2 up (skip piece), 3 left (skip word)
  let prev = new Int32Array(m + 1)
  let cur = new Int32Array(m + 1)
  for (let j = 1; j <= m; j++) ((prev[j] = j * GAP), (moves[j] = 3))
  for (let i = 1; i <= n; i++) {
    cur[0] = i * GAP
    moves[i * (m + 1)] = 2
    const pw = ps[i - 1].w
    for (let j = 1; j <= m; j++) {
      const s = similar(pw, ws[j - 1].w)
      const diag = prev[j - 1] + (s === 2 ? 3 : s === 1 ? 2 : -2)
      const up = prev[j] + GAP
      const left = cur[j - 1] + GAP
      if (diag >= up && diag >= left) ((cur[j] = diag), (moves[i * (m + 1) + j] = 1))
      else if (up >= left) ((cur[j] = up), (moves[i * (m + 1) + j] = 2))
      else ((cur[j] = left), (moves[i * (m + 1) + j] = 3))
    }
    ;[prev, cur] = [cur, prev]
  }
  const pairs = [] // [pieceIndex, wordIndex, quality]
  let i = n
  let j = m
  while (i > 0 || j > 0) {
    const mv = i === 0 ? 3 : j === 0 ? 2 : moves[i * (m + 1) + j]
    if (mv === 1) {
      const q = similar(ps[i - 1].w, ws[j - 1].w)
      if (q > 0) pairs.push([i - 1, j - 1, q])
      i--
      j--
    } else if (mv === 2) i--
    else j--
  }
  return pairs.reverse()
}

const files = readdirSync(asrDir).filter((f) => /^\d{3}\.json$/.test(f)).sort()
const wanted = only.length ? new Set(only.map((x) => String(x).padStart(3, '0'))) : null
const report = []
for (const f of files) {
  const nnn = f.slice(0, 3)
  if (wanted && !wanted.has(nnn)) continue
  const asr = JSON.parse(readFileSync(join(asrDir, f), 'utf8'))
  const text = readFileSync(join(textDir, `${nnn}.txt`), 'utf8')
  const { tokens } = tokenize(splitParagraphs(text))
  const ps = pieces(tokens)
  const ws = asr.words.map(([w, start, end]) => ({ w: norm(w), start, end })).filter((w) => w.w)
  const pairs = align(ps, ws)

  // First matched piece of each token gives its time.
  const times = new Array(tokens.length).fill(null)
  const quality = new Uint8Array(tokens.length)
  for (const [pi, wi, q] of pairs) {
    const ti = ps[pi].token
    if (times[ti] === null) ((times[ti] = ws[wi].start), (quality[ti] = q))
  }
  // Monotonic: a time can't be earlier than the previous token's.
  for (let t = 1; t < tokens.length; t++) if (times[t] !== null && times[t - 1] !== null && times[t] < times[t - 1]) times[t] = times[t - 1]
  // Fill gaps by spreading the untimed tokens evenly (by reading weight) between timed neighbours.
  const first = times.findIndex((t) => t !== null)
  const last = times.length - 1 - [...times].reverse().findIndex((t) => t !== null)
  if (first < 0) {
    report.push({ chapter: Number(nnn), matched: 0, note: 'no match' })
    continue
  }
  const rate = (times[last] - times[first]) / Math.max(1, tokens.slice(first, last).reduce((a, t) => a + t.weight, 0)) // seconds per weight unit
  for (let t = first - 1; t >= 0; t--) times[t] = Math.max(0, times[t + 1] - tokens[t].weight * rate)
  for (let t = last + 1; t < tokens.length; t++) times[t] = Math.min(asr.duration, times[t - 1] + tokens[t - 1].weight * rate)
  let a = first
  while (a < last) {
    let b = a + 1
    while (times[b] === null) b++
    if (b > a + 1) {
      const span = times[b] - times[a]
      const w = tokens.slice(a, b).reduce((s, t) => s + t.weight, 0)
      let acc = 0
      for (let t = a + 1; t < b; t++) {
        acc += tokens[t - 1].weight
        times[t] = times[a] + (span * acc) / w
      }
    }
    a = b
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
