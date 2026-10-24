import type { BookData, Character, Chapter, Note } from '../types'
import { currentAliases, currentTagline, isThing, metCharacters, notesUpTo, unlockedChapters } from './spoilers'

export type SearchHit =
  | { kind: 'character'; character: Character; matched: string; detail: string; score: number }
  | { kind: 'thing'; character: Character; matched: string; detail: string; score: number }
  | { kind: 'note'; note: Note; score: number }
  | { kind: 'chapter'; chapter: Chapter; score: number }

/** Lowercase and strip accents, so "dantes" finds "Dantès" and "mercedes" finds "Mercédès". */
export const fold = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’‘]/g, "'").toLowerCase()

/** 3 = whole text starts with the query, 2 = a word starts with it, 1 = contains it, 0 = no match. */
function rank(text: string, q: string): number {
  const t = fold(text)
  if (t.startsWith(q)) return 3
  if (t.split(/[^a-z0-9']+/).some((w) => w.startsWith(q))) return 2
  return t.includes(q) ? 1 : 0
}

/**
 * Search everything the reader has reached. Built only from the gated queries,
 * so a result can never reveal a name, alias or term from later in the book.
 */
export function search(book: BookData, upTo: number, query: string): SearchHit[] {
  const q = fold(query.trim())
  if (!q) return []
  const hits: SearchHit[] = []

  for (const c of metCharacters(book, upTo)) {
    const names = [c.name, ...currentAliases(c, upTo)]
    let best = 0
    let matched = c.name
    for (const n of names) {
      const r = rank(n, q)
      if (r > best) ((best = r), (matched = n))
    }
    const detail = currentTagline(c, upTo)
    const score = best ? best * 10 + (c.importance === 'major' ? 3 : c.importance === 'supporting' ? 2 : 1) : rank(detail, q) ? 2 : 0
    if (score) hits.push({ kind: isThing(c) ? 'thing' : 'character', character: c, matched, detail, score })
  }
  for (const n of notesUpTo(book, upTo)) {
    const r = rank(n.term, q)
    const score = r ? r * 10 + 1 : rank(n.text, q) ? 1 : 0
    if (score) hits.push({ kind: 'note', note: n, score })
  }
  for (const ch of unlockedChapters(book, upTo)) {
    const asNumber = /^\d+$/.test(q) && Number(q) === ch.number ? 40 : 0
    const r = rank(ch.title, q)
    const score = asNumber || (r ? r * 8 : rank(ch.summary, q) ? 1 : 0)
    if (score) hits.push({ kind: 'chapter', chapter: ch, score })
  }
  return hits.sort((a, b) => b.score - a.score)
}
