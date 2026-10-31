import { createContext, useContext } from 'react'
import type { BookData } from '../types'

export interface BookContextValue {
  book: BookData
  /** How far Virgil's material is visible: the bookmark, or the whole book when the spoiler guard is off. */
  upTo: number
  /** The reader's actual progress: the last chapter finished. */
  bookmark: number
  /** Spoiler guard off for this book. */
  reveal: boolean
  setReveal: (v: boolean) => void
  /** Move the bookmark (with toast + Undo). */
  setBookmark: (n: number) => void
  openBookmark: () => void
  /** The chapter picker: read or listen to any chapter. */
  openPicker: () => void
  openSearch: () => void
  openNote: (id: string) => void
  openSettings: () => void
  /** Welcome-back state for this session. */
  welcome: { gapDays: number } | null
  dismissWelcome: () => void
}

export const BookContext = createContext<BookContextValue | null>(null)

export function useBook(): BookContextValue {
  const ctx = useContext(BookContext)
  if (!ctx) throw new Error('useBook outside BookShell')
  return ctx
}
