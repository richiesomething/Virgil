import type { BookData, Character, Chapter } from '../types'

/**
 * Every query here takes `upTo`, the reader's bookmark, and never returns
 * anything the reader hasn't reached. All spoiler gating lives in this file.
 */

export function unlockedChapters(book: BookData, upTo: number): Chapter[] {
  return book.chapters.filter((c) => c.number <= upTo)
}

export function chapter(book: BookData, n: number, upTo: number): Chapter | undefined {
  return n <= upTo ? book.chapters.find((c) => c.number === n) : undefined
}

/** True once the character is known by its own name and hasn't folded into another. */
function isListed(c: Character, upTo: number): boolean {
  return c.firstChapter <= upTo && !(c.mergedInto && c.mergedInto.from <= upTo)
}

export function metCharacters(book: BookData, upTo: number): Character[] {
  return book.characters.filter((c) => isListed(c, upTo))
}

export type CharacterLookup =
  | { status: 'visible'; character: Character }
  | { status: 'merged'; into: string }
  | { status: 'hidden' }

export function lookupCharacter(book: BookData, id: string, upTo: number): CharacterLookup {
  const c = book.characters.find((x) => x.id === id)
  if (!c || c.firstChapter > upTo) return { status: 'hidden' }
  if (c.mergedInto && c.mergedInto.from <= upTo) return { status: 'merged', into: c.mergedInto.id }
  return { status: 'visible', character: c }
}

/** Characters that have folded into `id` by this point (their past appearances count as its own). */
function absorbed(book: BookData, id: string, upTo: number): Character[] {
  return book.characters.filter((c) => c.mergedInto?.id === id && c.mergedInto.from <= upTo)
}

/** Resolve a chapter's raw character id to the id the reader should see at `upTo`. */
export function displayId(book: BookData, id: string, upTo: number): string | undefined {
  const r = lookupCharacter(book, id, upTo)
  if (r.status === 'visible') return id
  if (r.status === 'merged') return displayId(book, r.into, upTo)
  return undefined
}

export function charactersInChapter(book: BookData, ch: Chapter, upTo: number): Character[] {
  const ids = new Set<string>()
  for (const raw of ch.characters) {
    const id = displayId(book, raw, upTo)
    if (id) ids.add(id)
  }
  return book.characters.filter((c) => ids.has(c.id))
}

export function newInChapter(book: BookData, n: number, upTo: number): Character[] {
  if (n > upTo) return []
  return metCharacters(book, upTo).filter((c) => c.firstChapter === n)
}

export interface CharacterView {
  character: Character
  aliases: { name: string; from: number; note?: string }[]
  tagline: string
  taglineFrom: number
  description: { from: number; text: string }[]
  moments: { chapter: number; text: string }[]
  appearances: number[]
  /** Earlier identities the reader now knows were this character. */
  formerly: Character[]
  lastUpdated: number
}

export function characterView(book: BookData, c: Character, upTo: number): CharacterView {
  const formerly = absorbed(book, c.id, upTo)
  const sources = [c, ...formerly]
  const reached = <T extends { from: number }>(xs: T[]) => xs.filter((x) => x.from <= upTo)

  const taglines = reached(c.tagline).sort((a, b) => a.from - b.from)
  const latest = taglines[taglines.length - 1] ?? { from: c.firstChapter, text: '' }

  const aliases = [
    ...reached(c.aliases),
    ...formerly.map((f) => ({ name: f.name, from: f.mergedInto!.from, note: undefined })),
  ].sort((a, b) => a.from - b.from)

  const description = reached(c.description).sort((a, b) => a.from - b.from)

  const moments = sources
    .flatMap((s) => s.moments)
    .filter((m) => m.chapter <= upTo)
    .sort((a, b) => a.chapter - b.chapter)

  const ids = new Set(sources.map((s) => s.id))
  const appearances = book.chapters
    .filter((ch) => ch.number <= upTo && ch.characters.some((id) => ids.has(id)))
    .map((ch) => ch.number)

  const lastUpdated = Math.max(
    c.firstChapter,
    latest.from,
    ...description.map((d) => d.from),
    ...aliases.map((a) => a.from),
  )

  return {
    character: c,
    aliases,
    tagline: latest.text,
    taglineFrom: latest.from,
    description,
    moments,
    appearances,
    formerly,
    lastUpdated,
  }
}

export function currentTagline(c: Character, upTo: number): string {
  const t = c.tagline.filter((x) => x.from <= upTo).sort((a, b) => a.from - b.from)
  return t[t.length - 1]?.text ?? ''
}

export function currentAliases(c: Character, upTo: number): string[] {
  return c.aliases.filter((a) => a.from <= upTo).map((a) => a.name)
}
