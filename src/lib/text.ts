// Where a book's text comes from: chapter files shipped with the app (public domain) or the
// reader's own copy (IndexedDB). Either way the reader gets a chapter as paragraphs.
import type { BookData, BookMeta } from '../types'
import { getCopy, type CopyInfo } from './copies'
import { createStore } from './store'

export type TextSource = 'shipped' | 'copy' | 'none'

/** Which text the reader would use, given whether a copy exists. */
export function textSource(meta: BookMeta, copy: CopyInfo | null | undefined): TextSource {
  if (meta.text?.status === 'shipped') return 'shipped'
  return copy ? 'copy' : 'none'
}

const cache = new Map<string, Promise<string[]>>()

/** A chapter's paragraphs. Rejects when the text isn't available. */
export function getChapterText(book: BookData, n: number): Promise<string[]> {
  const key = `${book.meta.id}/${n}`
  if (!cache.has(key)) {
    const p = book.meta.text?.status === 'shipped' ? fetchShipped(book.meta.id, n) : fromCopy(book.meta.id, n)
    cache.set(
      key,
      p.catch((e) => {
        cache.delete(key)
        throw e
      }),
    )
  }
  return cache.get(key)!
}

/** Forget a book's copy text, after it was removed or replaced. */
export function forgetText(bookId: string) {
  for (const k of [...cache.keys()]) if (k.startsWith(bookId + '/')) cache.delete(k)
}

async function fetchShipped(bookId: string, n: number): Promise<string[]> {
  const res = await fetch(`${import.meta.env.BASE_URL}texts/${bookId}/${String(n).padStart(3, '0')}.txt`)
  if (!res.ok) throw new Error(`Chapter ${n} text: ${res.status}`)
  return splitParagraphs(await res.text())
}

async function fromCopy(bookId: string, n: number): Promise<string[]> {
  const copy = await getCopy(bookId)
  const ch = copy?.chapters[n - 1]
  if (!ch) throw new Error('No copy of this book here')
  return ch
}

export function splitParagraphs(text: string): string[] {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n[ \t]*\n+/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

// ── Where the reader is in the text ───────────────────────────────────────

export interface ReadingPos {
  chapter: number
  /** Token index within the chapter. */
  word: number
  /** Tokens in the chapter, for a progress fraction. */
  words: number
  updatedAt: string
}

export const reading = createStore<Record<string, ReadingPos>>('virgil:reading:v1', {})

export function savePos(bookId: string, pos: Omit<ReadingPos, 'updatedAt'>) {
  reading.set((all) => ({ ...all, [bookId]: { ...pos, updatedAt: new Date().toISOString() } }))
}

/** The position to resume for chapter `n`, if the reader was partway through it. */
export function resumeFor(all: Record<string, ReadingPos>, bookId: string, n: number): ReadingPos | null {
  const p = all[bookId]
  return p && p.chapter === n && p.word > 0 && p.word < p.words ? p : null
}
