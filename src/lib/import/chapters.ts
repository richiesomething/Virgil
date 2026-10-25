// Lines an imported book up with Virgil's chapter numbering. Pure functions (tests/chapters.test.mjs).

export interface Para {
  text: string
  /** The parser saw this as a heading (an <h1>–<h6>, or large/centred text in a PDF). */
  heading?: boolean
}

export interface Detection {
  /** Paragraph index where each chapter starts, in order. */
  starts: number[]
  method: 'titles' | 'numbered' | 'none'
  /** Paragraph indexes that look like headings, for fixing the split by hand. */
  candidates: number[]
}

const WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty']
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 }
const HEAD = /^(chapter|chap\.?|part|book|section|letter|canto)\b/i
/** "Chapter 12", "XII.", "Twelve", "Chapter Twelve: The Mirror" */
const NUMBERED = /^(?:(?:chapter|chap\.?|part|book|section|letter|canto)\s+)?([0-9]{1,3}|[ivxlc]{1,8}|[a-z]+(?:[- ][a-z]+)?)(?=$|[\s.:—–-])/i

export const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’'`´]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

/** A title without any "Chapter 3." in front of it. */
export function stripNumber(s: string): string {
  return s.replace(/^\s*(?:chapter|chap\.?|part|book|section)\s*[0-9ivxlc]*\s*[.:—–-]?\s*/i, '').trim()
}

export function parseNumber(s: string): number | null {
  const t = s.toLowerCase().trim()
  if (/^\d+$/.test(t)) return Number(t)
  if (/^[ivxlc]+$/.test(t)) return roman(t)
  const i = WORDS.indexOf(t)
  if (i >= 0) return i + 1
  const m = t.match(/^([a-z]+)[- ]([a-z]+)$/)
  if (m && TENS[m[1]] && WORDS.indexOf(m[2]) >= 0 && WORDS.indexOf(m[2]) < 9) return TENS[m[1]] + WORDS.indexOf(m[2]) + 1
  if (TENS[t]) return TENS[t]
  return null
}

function roman(s: string): number | null {
  const v: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100 }
  let n = 0
  for (let i = 0; i < s.length; i++) {
    const a = v[s[i]]
    const b = v[s[i + 1]] ?? 0
    n += a < b ? -a : a
  }
  return n > 0 ? n : null
}

/** Short, with no sentence punctuation at the end: the shape of a heading. */
export function looksLikeHeading(p: Para): boolean {
  const t = p.text.trim()
  if (!t || t.length > 80) return false
  if (p.heading) return true
  if (HEAD.test(t)) return true
  return !/[.!?,;…”’"')]$/.test(t) && t.split(/\s+/).length <= 10
}

/** The chapter number a heading-like paragraph names, if any. */
export function headingNumber(text: string): number | null {
  const t = text.trim()
  if (t.length > 80) return null
  const m = t.match(NUMBERED)
  if (!m) return null
  const n = parseNumber(m[1])
  // A bare word ("Dawn") is only a number when it really is one, and only with a heading word or on its own.
  if (n === null) return null
  if (!HEAD.test(t) && !/^[0-9ivxlc]+[.:]?$/i.test(t) && !WORDS.includes(m[1].toLowerCase()) && !/^[a-z]+[- ][a-z]+$/i.test(m[1])) return null
  if (!HEAD.test(t) && /^[a-z]/i.test(m[1]) && t.split(/\s+/).length > 3) return null
  return n
}

export function detectChapters(paragraphs: Para[], titles: string[], chapterCount: number): Detection {
  const candidates = paragraphs.map((p, i) => (looksLikeHeading(p) ? i : -1)).filter((i) => i >= 0)

  // 1. Every known title, in order.
  const wanted = titles.map((t) => normalize(stripNumber(t))).filter(Boolean)
  if (wanted.length === chapterCount) {
    const starts: number[] = []
    let from = 0
    for (const title of wanted) {
      let found = -1
      for (let i = from; i < paragraphs.length; i++) {
        if (!looksLikeHeading(paragraphs[i])) continue
        if (normalize(stripNumber(paragraphs[i].text)) === title) {
          found = i
          break
        }
      }
      if (found < 0) break
      starts.push(found)
      from = found + 1
    }
    if (starts.length === chapterCount) return { starts: mergeHeadingPairs(paragraphs, starts), method: 'titles', candidates }
  }

  // 2. Numbered headings 1 … n, each after the last.
  const starts: number[] = []
  let next = 1
  for (const i of candidates) {
    const n = headingNumber(paragraphs[i].text)
    if (n === next) {
      starts.push(i)
      next++
    }
  }
  if (starts.length === chapterCount) return { starts, method: 'numbered', candidates }

  // Not found: hand back the numbered headings that were, as a start for fixing by hand.
  return { starts, method: 'none', candidates }
}

/** "CHAPTER ONE" on one line and the title on the next: start at the first of the pair. */
function mergeHeadingPairs(paragraphs: Para[], starts: number[]): number[] {
  return starts.map((s) => (s > 0 && looksLikeHeading(paragraphs[s - 1]) && headingNumber(paragraphs[s - 1].text) !== null && !starts.includes(s - 1) ? s - 1 : s))
}

/** Chapter texts from the starts: heading lines at the top of each are dropped. */
export function splitChapters(paragraphs: Para[], starts: number[]): string[][] {
  return starts.map((s, i) => {
    const end = starts[i + 1] ?? paragraphs.length
    let body = paragraphs.slice(s, end)
    while (body.length > 1 && looksLikeHeading(body[0])) body = body.slice(1)
    return body.map((p) => p.text.replace(/\s+/g, ' ').trim()).filter(Boolean)
  })
}

export const wordCount = (paragraphs: string[]) => paragraphs.reduce((n, p) => n + p.split(/\s+/).filter(Boolean).length, 0)
