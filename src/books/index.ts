import type { BookData, BookMeta } from '../types'

// Every book is a folder in src/books/ built by `node scripts/merge-data.mjs` from data-src/<book>/.
// Adding a book needs no code: its book.json is found here and its data.json is loaded on demand.

const metas = import.meta.glob<BookMeta>('./*/book.json', { eager: true, import: 'default' })
const datas = import.meta.glob<Omit<BookData, 'meta' | 'notes' | 'insights'>>('./*/data.json', { import: 'default' })
const extraFiles = import.meta.glob<Pick<BookData, 'notes' | 'insights'>>('./*/extra.json', { import: 'default' })
const detailFiles = import.meta.glob<string[][]>('./*/details.json', { import: 'default' })

/** Metadata for every book in the library (cheap; loaded up front). */
export const library: BookMeta[] = Object.values(metas).sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.title.localeCompare(b.title))

const cache = new Map<string, Promise<BookData>>()

/**
 * Book data is code-split so the library stays fast as it grows. This resolves with the core data, whose
 * glossary notes and insights are still empty (`extrasPending`); loadExtras fills them in.
 */
export function loadBook(id: string): Promise<BookData> | undefined {
  const meta = library.find((b) => b.id === id)
  const load = datas[`./${id}/data.json`]
  if (!meta || !load) return undefined
  if (!cache.has(id))
    cache.set(
      id,
      load()
        .then((data) => ({ meta, notes: [], ...data, extrasPending: !!extraFiles[`./${id}/extra.json`] }))
        .catch((e) => {
          cache.delete(id) // let the next visit try again
          throw e
        }),
    )
  return cache.get(id)
}

const details = new Map<string, Promise<string[][]>>()

/** Every chapter's detail paragraphs (index = chapter − 1). The longest text in a book, read on one page only, so it's its own chunk. */
export function loadDetails(id: string): Promise<string[][]> {
  const load = detailFiles[`./${id}/details.json`]
  if (!load) return Promise.resolve([])
  if (!details.has(id))
    details.set(
      id,
      load().catch((e) => {
        details.delete(id)
        throw e
      }),
    )
  return details.get(id)!
}

const extras = new Map<string, Promise<Pick<BookData, 'notes' | 'insights'>>>()

/** A book's glossary notes and insights: the second chunk, fetched as soon as the core data is on screen. */
export function loadExtras(id: string): Promise<Pick<BookData, 'notes' | 'insights'>> {
  const load = extraFiles[`./${id}/extra.json`]
  if (!load) return Promise.resolve({ notes: [] })
  if (!extras.has(id))
    extras.set(
      id,
      load().catch((e) => {
        extras.delete(id)
        throw e
      }),
    )
  return extras.get(id)!
}
