import type { BookData, Character, Chapter, Kin, Kind, Note, Primer, Recap, RelationType, RelationshipState } from '../types'

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
    ...formerly
      .filter((f) => !c.aliases.some((a) => a.name === f.name && a.from <= upTo))
      .map((f) => ({ name: f.name, from: f.mergedInto!.from, note: undefined })),
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

export interface Connection {
  /** Display ids (after resolving disguises the reader has seen through). */
  a: string
  b: string
  type: RelationType
  label: string
  /** How `a` is related to `b`, if they're family or married. */
  kin?: Kin
  /** Chapter the current state became known. */
  since: number
  /** Every state the reader has reached, oldest first (kin relative to this a/b). */
  history: RelationshipState[]
}

const flipKin: Record<Kin, Kin> = {
  parent: 'child',
  child: 'parent',
  grandparent: 'grandchild',
  grandchild: 'grandparent',
  sibling: 'sibling',
  spouse: 'spouse',
  relative: 'relative',
}

/** What `other` is to the person on the other end of `c`, e.g. 'child'. */
export function kinRole(c: Connection, other: string): Kin | undefined {
  if (!c.kin) return undefined
  return other === c.b ? flipKin[c.kin] : c.kin
}

/**
 * Relationships as the reader knows them at `upTo`. Links to a disguise fold onto
 * the real character once the reader knows who it is; if that leaves several
 * links between the same pair, the most recently revealed state wins.
 */
export function connections(book: BookData, upTo: number): Connection[] {
  const byPair = new Map<string, Connection>()
  for (const r of book.relationships) {
    const a = displayId(book, r.a, upTo)
    const b = displayId(book, r.b, upTo)
    if (!a || !b || a === b) continue
    const [x, y] = a < b ? [a, b] : [b, a]
    // Kin is stored relative to the data's a/b; re-orient it to x/y.
    const reached = r.states
      .filter((s) => s.from <= upTo)
      .map((s) => (s.kin && a !== x ? { ...s, kin: flipKin[s.kin] } : s))
    if (!reached.length) continue
    const key = x + '|' + y
    const existing = byPair.get(key)
    const history = [...(existing?.history ?? []), ...reached].sort((p, q) => p.from - q.from)
    const latest = history[history.length - 1]
    byPair.set(key, { a: x, b: y, type: latest.type, label: latest.label, kin: latest.kin, since: latest.from, history })
  }
  return [...byPair.values()]
}

export function connectionsOf(book: BookData, id: string, upTo: number): Connection[] {
  return connections(book, upTo).filter((c) => c.a === id || c.b === id)
}

export const kindOf = (c: Character): Kind => c.kind ?? 'character'
export const isThing = (c: Character) => kindOf(c) !== 'character'

/**
 * Generation numbers for the family view: parents sit a row above their
 * children, spouses and siblings share a row. Other relatives don't constrain.
 */
export function generations(links: Connection[]): Map<string, number> {
  const level = new Map<string, number>()
  const get = (id: string) => level.get(id) ?? 0
  for (const l of links) if (l.kin) (level.set(l.a, 0), level.set(l.b, 0))
  const below = (upper: string, lower: string, gap: number) => {
    if (get(lower) < get(upper) + gap) return level.set(lower, get(upper) + gap), true
    return false
  }
  for (let pass = 0, changed = true; changed && pass < 60; pass++) {
    changed = false
    for (const l of links) {
      if (l.kin === 'parent') changed = below(l.a, l.b, 1) || changed
      else if (l.kin === 'child') changed = below(l.b, l.a, 1) || changed
      else if (l.kin === 'grandparent') changed = below(l.a, l.b, 2) || changed
      else if (l.kin === 'grandchild') changed = below(l.b, l.a, 2) || changed
      else if (l.kin === 'spouse' || l.kin === 'sibling') {
        const m = Math.max(get(l.a), get(l.b))
        if (get(l.a) !== m || get(l.b) !== m) (level.set(l.a, m), level.set(l.b, m), (changed = true))
      }
    }
  }
  return level
}

/**
 * Target positions for the family view: each family (connected group) gets its
 * own block, blocks are packed into rows, and generations stack inside a block.
 */
export function familyAnchors(links: Connection[], rowWidth = 900): Map<string, { x: number; y: number }> {
  const level = generations(links)
  const adj = new Map<string, string[]>()
  for (const l of links) {
    adj.set(l.a, [...(adj.get(l.a) ?? []), l.b])
    adj.set(l.b, [...(adj.get(l.b) ?? []), l.a])
  }
  const seen = new Set<string>()
  const families: string[][] = []
  for (const id of adj.keys()) {
    if (seen.has(id)) continue
    const group: string[] = []
    const stack = [id]
    seen.add(id)
    while (stack.length) {
      const cur = stack.pop()!
      group.push(cur)
      for (const n of adj.get(cur) ?? []) if (!seen.has(n)) (seen.add(n), stack.push(n))
    }
    families.push(group)
  }
  families.sort((p, q) => q.length - p.length)

  const anchors = new Map<string, { x: number; y: number }>()
  const rowGap = 120
  let x = 0, y = 0, rowHeight = 0
  for (const fam of families) {
    const rows = new Map<number, number>()
    let maxLevel = 0
    for (const id of fam) {
      const l = level.get(id) ?? 0
      rows.set(l, (rows.get(l) ?? 0) + 1)
      maxLevel = Math.max(maxLevel, l)
    }
    const width = Math.max(...rows.values()) * 110 + 60
    const height = (maxLevel + 1) * rowGap + 60
    if (x > 0 && x + width > rowWidth) ((x = 0), (y += rowHeight), (rowHeight = 0))
    for (const id of fam) anchors.set(id, { x: x + width / 2, y: y + (level.get(id) ?? 0) * rowGap })
    x += width
    rowHeight = Math.max(rowHeight, height)
  }
  return anchors
}

// ── Reading guide ──────────────────────────────────────────────────────────

/** Every note the reader has reached (the book's glossary so far). */
export function notesUpTo(book: BookData, upTo: number): Note[] {
  return book.notes.filter((n) => n.chapter <= upTo)
}

/** Notes for a chapter: terms introduced there, then ones that come back there. */
export function notesForChapter(book: BookData, n: number, upTo: number): { introduced: Note[]; returning: Note[] } {
  if (n > upTo) return { introduced: [], returning: [] }
  return {
    introduced: book.notes.filter((x) => x.chapter === n),
    returning: book.notes.filter((x) => x.chapter < n && x.seeAlso?.includes(n)),
  }
}

/** The primer for chapter n — only for chapters the reader has reached or is about to read. */
export function primerFor(book: BookData, n: number, upTo: number): Primer | undefined {
  if (n > upTo + 1) return undefined
  return book.primers.find((p) => p.chapter === n)
}

/** The latest "story so far" checkpoint reached, and the chapters since it. */
export function recapFor(book: BookData, upTo: number): { checkpoint?: Recap; since: Chapter[] } {
  const checkpoint = [...book.recaps].reverse().find((r) => r.through <= upTo)
  const from = checkpoint ? checkpoint.through + 1 : 1
  return { checkpoint, since: book.chapters.filter((c) => c.number >= from && c.number <= upTo) }
}

/** People most present in the last few chapters read, most recent weighted highest. */
export function whoMattersNow(book: BookData, upTo: number, limit = 6, window = 5): Character[] {
  const score = new Map<string, number>()
  for (let n = Math.max(1, upTo - window + 1); n <= upTo; n++) {
    const ch = book.chapters[n - 1]
    if (!ch) continue
    const weight = 1 + (n - (upTo - window)) / window
    for (const c of charactersInChapter(book, ch, upTo)) {
      if (isThing(c)) continue
      const bonus = c.importance === 'major' ? 1.3 : c.importance === 'supporting' ? 1.1 : 1
      score.set(c.id, (score.get(c.id) ?? 0) + weight * bonus)
    }
  }
  const byId = new Map(book.characters.map((c) => [c.id, c]))
  return [...score.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => byId.get(id)!)
}
