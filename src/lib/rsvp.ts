// The flash reader's engine: turns chapter text into words with display times and a pivot letter.
// Pure functions, so they can be tested with node (tests/rsvp.test.mjs).

export interface Token {
  /** What is shown, including attached punctuation. */
  text: string
  /** Index of the letter held at the fixed point (optimal recognition point). */
  pivot: number
  /** Display time as a multiple of the base word time. */
  weight: number
  paragraph: number
  sentence: number
  /** Position of the first character in the paragraph's text. */
  offset: number
}

export interface ChapterTokens {
  tokens: Token[]
  /** Token index where each sentence starts. */
  sentenceStarts: number[]
  /** Token index where each paragraph starts. */
  paragraphStarts: number[]
}

const SENTENCE_END = /[.!?…]+[”’"')\]]*$/
const CLAUSE_END = /[,;:—–]+[”’"')\]]*$/
const SMALL_END = /^[”’"')\]]+$/

/** Spritz's table: where the eye lands on a word of a given length. */
export function pivotIndex(word: string): number {
  const letters = word.replace(/^[^\p{L}\p{N}]+/u, '')
  const lead = word.length - letters.length
  const len = letters.replace(/[^\p{L}\p{N}]+$/u, '').length
  const p = len <= 1 ? 0 : len <= 5 ? 1 : len <= 9 ? 2 : len <= 13 ? 3 : 4
  return Math.min(word.length - 1, lead + p)
}

/** How long a word is held, relative to the base time. */
export function weightOf(text: string, paragraphEnd: boolean): number {
  const core = text.replace(/[^\p{L}\p{N}]/gu, '')
  let w = 1
  if (core.length > 8) w += 0.2 + Math.min(0.6, Math.floor((core.length - 9) / 3) * 0.1)
  if (/\d/.test(core)) w = Math.max(w, 1.3)
  if (paragraphEnd) w *= 2.5
  else if (SENTENCE_END.test(text)) w *= 2
  else if (CLAUSE_END.test(text)) w *= 1.5
  return w
}

/** Words longer than 13 letters are shown in two parts. */
function splitLong(word: string): string[] {
  const core = word.replace(/[^\p{L}\p{N}]/gu, '')
  if (core.length <= 13) return [word]
  const hy = word.indexOf('-', 3)
  if (hy > 0 && hy < word.length - 3) return [word.slice(0, hy + 1), word.slice(hy + 1)]
  const cut = Math.ceil(word.length / 2)
  return [word.slice(0, cut) + '-', word.slice(cut)]
}

/** Break on whitespace, and after an em dash that joins two words. */
function words(paragraph: string): { text: string; offset: number }[] {
  const out: { text: string; offset: number }[] = []
  const re = /\S+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(paragraph))) {
    const raw = m[0]
    const parts = raw.split(/(?<=—)/).filter(Boolean)
    let offset = m.index
    for (const part of parts) {
      for (const piece of splitLong(part)) {
        if (!SMALL_END.test(piece) || !out.length) out.push({ text: piece, offset })
        else out[out.length - 1].text += piece // a lone closing quote joins the previous word
        offset += piece.length
      }
    }
  }
  return out
}

export function tokenize(paragraphs: string[]): ChapterTokens {
  const tokens: Token[] = []
  const sentenceStarts: number[] = []
  const paragraphStarts: number[] = []
  let sentence = 0
  paragraphs.forEach((p, pi) => {
    const ws = words(p)
    if (!ws.length) return
    paragraphStarts.push(tokens.length)
    let startOfSentence = true
    ws.forEach((w, i) => {
      if (startOfSentence) {
        sentenceStarts.push(tokens.length)
        startOfSentence = false
      }
      const last = i === ws.length - 1
      tokens.push({ text: w.text, pivot: pivotIndex(w.text), weight: weightOf(w.text, last), paragraph: pi, sentence, offset: w.offset })
      // "Mr." and initials don't end sentences; anything else with a full stop does.
      const abbrev = /^(Mr|Mrs|Ms|Dr|St|Mme|Mlle|M|Capt|Col|Gen|Lt|Prof|Sr|Jr|vs|No)\.$/.test(w.text) || /^\p{Lu}\.$/u.test(w.text)
      if (last || (SENTENCE_END.test(w.text) && !abbrev)) {
        sentence++
        startOfSentence = true
      }
    })
  })
  return { tokens, sentenceStarts, paragraphStarts }
}

/** Milliseconds a token stays on screen at a given speed. */
export function msFor(token: Token, wpm: number): number {
  return (60000 / wpm) * token.weight
}

/** Slow start after play: the first few words ease up to full speed. */
export function rampFactor(wordsSincePlay: number, ramp = 6): number {
  if (wordsSincePlay >= ramp) return 1
  return 2 - wordsSincePlay / ramp
}

/** Index of the sentence start at or before `i`; with `back`, the one before that if `i` is already a start. */
export function sentenceStartBefore(c: ChapterTokens, i: number, back = false): number {
  let s = 0
  for (const start of c.sentenceStarts) {
    if (start <= i) s = start
    else break
  }
  if (back && s === i) {
    const prev = c.sentenceStarts.filter((x) => x < i)
    return prev.length ? prev[prev.length - 1] : 0
  }
  return s
}

export function sentenceStartAfter(c: ChapterTokens, i: number): number {
  const next = c.sentenceStarts.find((x) => x > i)
  return next ?? c.tokens.length
}

/** Rough minutes to read `count` words at `wpm`, allowing for punctuation pauses. */
export function minutesFor(count: number, wpm: number): number {
  return (count * 1.15) / wpm
}
