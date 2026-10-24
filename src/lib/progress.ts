import { useCallback, useSyncExternalStore } from 'react'
import { logBookmarkChange } from './store'

/** Bookmark = the last chapter the reader has finished (0 = not started). */
const KEY = 'virgil:progress:v1'
type Progress = Record<string, number>

let memory: Progress = read()
const listeners = new Set<() => void>()

function read(): Progress {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Progress) : {}
  } catch {
    return {}
  }
}

function write(next: Progress) {
  memory = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Storage may be unavailable (private mode); progress then lasts for the session only.
  }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      memory = read()
      listener()
    }
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

export function getProgress(bookId: string): number {
  return memory[bookId] ?? 0
}

export function useAllProgress(): Progress {
  return useSyncExternalStore(subscribe, () => memory)
}

export function useBookmark(bookId: string, chapterCount: number) {
  const chapter = useSyncExternalStore(subscribe, () => memory[bookId] ?? 0)
  const setChapter = useCallback(
    (n: number) => {
      const clamped = Math.max(0, Math.min(chapterCount, Math.round(n)))
      logBookmarkChange(bookId, memory[bookId] ?? 0, clamped)
      write({ ...memory, [bookId]: clamped })
    },
    [bookId, chapterCount],
  )
  return [chapter, setChapter] as const
}
