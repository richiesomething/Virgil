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
/** A heading word followed by a number (or nothing): "Chapter 12", "Part Two:", "Chapter" alone; not "Part of the crew". */
const HEAD = /^(chapter|chap\.?|part|book|section|letter|canto)\s*(?:([0-9]+|[ivxlc]+|[a-z]+(?:[- ][a-z]+)?)\s*)?(?:[.:—–-]|$)/i
/** "Chapter 12", "XII.", "Twelve", "Chapter Twelve: The Mirror" */
const NUMBERED = /^(?:(?:chapter|chap\.?|part|book|section|letter|canto)\s+)?([0-9]{1,3}|[ivxlc]{1,8}|[a-z]+(?:[- ][a-z]+)?)(?=$|[\s.:—–-])/i

export const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’'`´]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

const NUMBER_WORDS = '(?:[0-9]+|[ivxlc]+|(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[- ](?:one|two|three|four|five|six|seven|eight|nine))?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)'
const NUMBER_PREFIX = new RegExp(`^\\s*(?:(?:chapter|chap\\.?|part|book|section)\\s*${NUMBER_WORDS}?|${NUMBER_WORDS})?\\s*(?:[.:—–-]\\s*|\\s+|$)`, 'i')
const BACK_MATTER = /^(about the author|about the translator|acknowledg|appendix|afterword|author'?s note|translator'?s note|notes$|endnotes|also by|glossary|bibliography|index$|colophon)/i

/** A title without any "Chapter 3.", "Chapter One:" or "4" in front of it. */
export function stripNumber(s: string): string {
  const m = s.match(NUMBER_PREFIX)
  if (!m || !m[0].trim()) return s.trim()
  const rest = s.slice(m[0].length).trim()
  // "Seven" as a whole title is a title, not a number.
  return rest || (/^\s*(?:chapter|chap\.?|part|book|section)/i.test(s) ? '' : s.trim())
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
  if (/^(\d+|[IVXLC]+)[.:]?$/.test(t)) return true // "12." or "IV" alone
  return !/[.!?,;…”’"')]$/.test(t) && t.split(/\s+/).length <= 10
}

/** Short and unpunctuated like a title; "!" and "?" are allowed ("At Random!"). */
const titleShaped = (p: Para) => p.heading || (p.text.trim().length <= 80 && !/[.,;…”’"')]$/.test(p.text.trim()) && p.text.trim().split(/\s+/).length <= 10)

/** The chapter number a heading-like paragraph names, if any. */
export function headingNumber(text: string, flagged = false): number | null {
  const t = text.trim()
  if (t.length > 80) return null
  const m = t.match(NUMBERED)
  if (!m) return null
  const n = parseNumber(m[1])
  // "One." with a full stop is a sentence, not a number word.
  if (/^[a-z]/i.test(m[1]) && /\.$/.test(t)) return null
  // A heading the parser flagged that starts with a digit ("4 Ned Land") is a numbered chapter.
  if (flagged && n !== null && /^\d{1,3}\s+\S/.test(t)) return n
  // A bare word ("Dawn") is only a number when it really is one, and only with a heading word or on its own.
  if (n === null) return null
  const headWord = /^(chapter|chap\.?|part|book|section|letter|canto)\b/i.test(t) // "Chapter 1 A Runaway Reef" counts too
  if (!headWord && !/^[0-9ivxlc]+[.:]?$/i.test(t) && !WORDS.includes(m[1].toLowerCase()) && !/^[a-z]+[- ][a-z]+$/i.test(m[1])) return null
  if (!headWord && /^[a-z]/i.test(m[1]) && t.split(/\s+/).length > 3) return null
  return n
}

export function detectChapters(paragraphs: Para[], titles: string[], chapterCount: number): Detection {
  const candidates = paragraphs.map((p, i) => (looksLikeHeading(p) ? i : -1)).filter((i) => i >= 0)
  // A table of contents matches every heading too, with nothing between them: a real chapter has text.
  const plausible = (starts: number[]) => {
    return starts.every((s, i) => (starts[i + 1] ?? paragraphs.length) - s > 1)
  }

  // 1. Every known title, in order (searching again past a contents page if the first match is one).
  const wanted = titles.map((t) => normalize(stripNumber(t))).filter(Boolean)
  if (wanted.length === chapterCount) {
    let from = 0
    for (let attempt = 0; attempt < 3; attempt++) {
      const starts: number[] = []
      for (const title of wanted) {
        let found = -1
        for (let i = from; i < paragraphs.length; i++) {
          if (!titleShaped(paragraphs[i])) continue
          if (normalize(stripNumber(paragraphs[i].text)) === title) {
            found = i
            break
          }
        }
        if (found < 0) break
        starts.push(found)
        from = found + 1
      }
      if (starts.length !== chapterCount) break
      if (plausible(starts)) return { starts: mergeHeadingPairs(paragraphs, starts), method: 'titles', candidates }
    }
  }

  // 2. Numbered headings 1 … n, each after the last.
  let starts: number[] = []
  for (let attempt = 0, from = 0; attempt < 3; attempt++) {
    starts = []
    let next = 1
    for (const i of candidates) {
      if (i < from) continue
      const n = headingNumber(paragraphs[i].text, paragraphs[i].heading)
      if (n === next) {
        starts.push(i)
        next++
      }
    }
    if (starts.length !== chapterCount) break
    if (plausible(starts)) return { starts, method: 'numbered', candidates }
    from = starts[starts.length - 1] + 1
  }

  // Not found: hand back the numbered headings that were, as a start for fixing by hand.
  return { starts, method: 'none', candidates }
}

/** "CHAPTER ONE" on one line and the title on the next: start at the first of the pair. */
function mergeHeadingPairs(paragraphs: Para[], starts: number[]): number[] {
  return starts.map((s, i) => {
    const prev = paragraphs[s - 1]
    // Only a bare number line for this chapter ("CHAPTER ONE", "XII"), not a contents entry with its own title.
    const rest = prev?.text.replace(/^(chapter|chap\.?|part|book|section|letter|canto)\s*/i, '').replace(/\s*[.:—–-]\s*$/, '').trim() ?? ''
    const bare = prev && looksLikeHeading(prev) && headingNumber(prev.text) === i + 1 && parseNumber(rest) !== null
    return bare && !starts.includes(s - 1) ? s - 1 : s
  })
}

/**
 * Chapter texts from the starts. Heading lines at the top of each are dropped: the parser's headings,
 * numbered lines and the chapter's known title. A short first line of text ("Yes.") is kept.
 */
export function splitChapters(paragraphs: Para[], starts: number[], titles: string[] = []): string[][] {
  const known = new Set(titles.map((t) => normalize(stripNumber(t))).filter(Boolean))
  const isHeading = (p: Para) => p.heading || headingNumber(p.text) !== null || known.has(normalize(stripNumber(p.text)))
  return starts.map((s, i) => {
    let end = starts[i + 1] ?? paragraphs.length
    // Back matter after the last chapter ("About the author") is not part of it.
    if (i === starts.length - 1) {
      const cut = paragraphs.findIndex((p, j) => j > s + 2 && (p.heading || looksLikeHeading(p)) && BACK_MATTER.test(p.text.trim()))
      if (cut > 0) end = cut
    }
    let body = paragraphs.slice(s, end)
    // The start line itself; after a bare number line ("CHAPTER 1"), the title line that usually follows it.
    const numbered = headingNumber(body[0].text) !== null && !known.has(normalize(stripNumber(body[0].text)))
    body = body.slice(1)
    if (numbered && body.length > 1 && titleShaped(body[0]) && !/\.$/.test(body[0].text.trim())) body = body.slice(1)
    while (body.length > 1 && isHeading(body[0])) body = body.slice(1)
    return body.map((p) => p.text.replace(/\s+/g, ' ').trim()).filter(Boolean)
  })
}

export const wordCount = (paragraphs: string[]) => paragraphs.reduce((n, p) => n + p.split(/\s+/).filter(Boolean).length, 0)
