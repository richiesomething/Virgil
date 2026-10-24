import { createContext, useContext } from 'react'
import type { BookData } from '../types'

export interface BookContextValue {
  book: BookData
  upTo: number
  /** Move the bookmark (with toast + Undo). */
  setBookmark: (n: number) => void
  openBookmark: () => void
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
