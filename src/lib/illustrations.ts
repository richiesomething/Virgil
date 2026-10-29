// Period illustrations shown while reading: a few per book. Each one depicts a passage of its chapter (from one phrase
// to another). While the reading is inside that passage the picture is pinned above the words; afterwards it sits inline
// in the Text view, right after the passage, so a picture never shows anything the reader hasn't reached.
// public/texts/<id>/illustrations.json lists them.

export interface Illustration {
  chapter: number
  /** A phrase from the paragraph where the depicted passage starts. */
  from: string
  /** A phrase from the paragraph where it ends (the first match at or after `from`); defaults to `from`. */
  to?: string
  /** A phrase from the paragraph the inline picture follows; defaults to `to`. */
  after?: string
  file: string
  width: number
  height: number
  caption: string
  /** Credit for a picture from another source than the set's edition (artist, title, year, where it comes from). */
  credit?: string
}

export interface IllustrationSet {
  edition: string
  source: string
  license: string
  credit: string
  items: Illustration[]
}

/** An illustration resolved against a chapter's paragraphs. */
export interface Placed {
  item: Illustration
  from: number
  to: number
  after: number
}

const sets = new Map<string, Promise<IllustrationSet | null>>()

/** The book's illustrations, or null when it has none (fetched once per session). */
export function getIllustrations(bookId: string): Promise<IllustrationSet | null> {
  if (!sets.has(bookId))
    sets.set(
      bookId,
      fetch(`${import.meta.env.BASE_URL}texts/${bookId}/illustrations.json`)
        .then((r) => (r.ok ? (r.json() as Promise<IllustrationSet>) : null))
        .catch(() => null),
    )
  return sets.get(bookId)!
}

export const illustrationUrl = (bookId: string, file: string) => `${import.meta.env.BASE_URL}texts/${bookId}/img/${file}`

export const fold = (s: string) =>
  s
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Where each of the chapter's illustrations sits: the paragraph its passage starts in, ends in, and the one the inline
 * picture follows. Illustrations whose phrases don't match are left out, so a bad anchor can never misplace a picture.
 */
export function placeIllustrations(items: Illustration[], chapter: number, paragraphs: string[]): Placed[] {
  const folded = paragraphs.map(fold)
  const find = (phrase: string, start = 0) => {
    const needle = fold(phrase)
    for (let i = start; i < folded.length; i++) if (folded[i].includes(needle)) return i
    return -1
  }
  const out: Placed[] = []
  for (const item of items) {
    if (item.chapter !== chapter) continue
    const from = find(item.from)
    if (from < 0) continue
    const to = item.to ? find(item.to, from) : from
    if (to < 0) continue
    const after = item.after ? find(item.after, from) : to
    if (after < 0) continue
    out.push({ item, from, to, after })
  }
  return out
}

/** The illustration whose passage the reader is in, if any. */
export const pinnedAt = (placed: Placed[], paragraph: number) => placed.find((p) => paragraph >= p.from && paragraph <= p.to) ?? null
