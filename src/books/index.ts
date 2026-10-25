import type { BookData, BookMeta } from '../types'

// Every book is a folder in src/books/ built by `node scripts/merge-data.mjs` from data-src/<book>/.
// Adding a book needs no code: its book.json is found here and its data.json is loaded on demand.

const metas = import.meta.glob<BookMeta>('./*/book.json', { eager: true, import: 'default' })
const datas = import.meta.glob<Omit<BookData, 'meta'>>('./*/data.json', { import: 'default' })

/** Metadata for every book in the library (cheap; loaded up front). */
export const library: BookMeta[] = Object.values(metas).sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.title.localeCompare(b.title))

const cache = new Map<string, Promise<BookData>>()

/** Full book data is code-split so the library stays fast as it grows. */
export function loadBook(id: string): Promise<BookData> | undefined {
  const meta = library.find((b) => b.id === id)
  const load = datas[`./${id}/data.json`]
  if (!meta || !load) return undefined
  if (!cache.has(id))
    cache.set(
      id,
      load()
        .then((data) => ({ meta, ...data }))
        .catch((e) => {
          cache.delete(id) // let the next visit try again
          throw e
        }),
    )
  return cache.get(id)
}
