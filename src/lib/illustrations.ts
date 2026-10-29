// Period illustrations shown inline in the Text view: a few per book, each placed after the paragraph it depicts,
// so a picture never shows anything the reader hasn't reached. public/texts/<id>/illustrations.json lists them.

export interface Illustration {
  chapter: number
  /** A phrase from the paragraph the picture follows. */
  after: string
  file: string
  width: number
  height: number
  caption: string
}

export interface IllustrationSet {
  edition: string
  source: string
  license: string
  credit: string
  items: Illustration[]
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

const fold = (s: string) =>
  s
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Which paragraph each illustration follows: the first paragraph containing its `after` phrase.
 * Returns a map from paragraph index to the illustrations placed after it; unmatched ones are left out.
 */
export function placeIllustrations(items: Illustration[], chapter: number, paragraphs: string[]): Map<number, Illustration[]> {
  const out = new Map<number, Illustration[]>()
  const folded = paragraphs.map(fold)
  for (const it of items) {
    if (it.chapter !== chapter) continue
    const needle = fold(it.after)
    const i = folded.findIndex((p) => p.includes(needle))
    if (i < 0) continue
    out.set(i, [...(out.get(i) ?? []), it])
  }
  return out
}
