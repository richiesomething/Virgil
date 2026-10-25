// The reader's own copy of a book (EPUB, PDF or text they imported), kept in IndexedDB on this device.
// A copy is the book's chapters as paragraphs, lined up with Virgil's chapter numbering.
import { useSyncExternalStore } from 'react'

export interface BookCopy {
  bookId: string
  file: { name: string; size: number; type: string }
  importedAt: string
  /** Paragraphs per chapter; index 0 = chapter 1. */
  chapters: string[][]
  wordCounts: number[]
}

export type CopyInfo = Omit<BookCopy, 'chapters'>

const DB = 'virgil'
const STORE = 'copies'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('No storage'))
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'bookId' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = run(db.transaction(STORE, mode).objectStore(STORE))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

export const getCopy = (bookId: string) => tx<BookCopy | undefined>('readonly', (s) => s.get(bookId))

export async function putCopy(copy: BookCopy) {
  await tx('readwrite', (s) => s.put(copy))
  remember(copy.bookId, strip(copy))
}

export async function deleteCopy(bookId: string) {
  await tx('readwrite', (s) => s.delete(bookId))
  remember(bookId, null)
}

const strip = ({ chapters, ...info }: BookCopy): CopyInfo => info

// ── Availability for the UI ───────────────────────────────────────────────
// Which books have a copy is cached in memory, so components can read it synchronously.

type State = { status: 'loading' } | { status: 'none' } | { status: 'ready'; info: CopyInfo }
const states = new Map<string, State>()
const listeners = new Set<() => void>()
const LOADING: State = { status: 'loading' }

function remember(bookId: string, info: CopyInfo | null) {
  states.set(bookId, info ? { status: 'ready', info } : { status: 'none' })
  listeners.forEach((l) => l())
}

function load(bookId: string) {
  if (states.has(bookId)) return
  states.set(bookId, LOADING)
  getCopy(bookId)
    .then((c) => remember(bookId, c ? strip(c) : null))
    .catch(() => remember(bookId, null))
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

/** Whether this browser holds the reader's own copy of the book. */
export function useCopy(bookId: string): State {
  load(bookId)
  return useSyncExternalStore(subscribe, () => states.get(bookId) ?? LOADING)
}
