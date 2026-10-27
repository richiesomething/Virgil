import { useSyncExternalStore } from 'react'

/**
 * A tiny localStorage-backed store. Falls back to memory when storage is
 * unavailable (private mode), and syncs across tabs.
 */
export function createStore<T>(key: string, initial: T) {
  const listeners = new Set<() => void>()
  const read = (): T => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? { ...initial, ...JSON.parse(raw) } : initial
    } catch {
      return initial
    }
  }
  let value = read()

  const set = (next: T | ((prev: T) => T)) => {
    value = typeof next === 'function' ? (next as (prev: T) => T)(value) : next
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Storage unavailable; keep the value for this session only.
    }
    listeners.forEach((l) => l())
  }
  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) ((value = read()), listener())
    }
    window.addEventListener('storage', onStorage)
    return () => {
      listeners.delete(listener)
      window.removeEventListener('storage', onStorage)
    }
  }
  const use = () => useSyncExternalStore(subscribe, () => value)
  return { get: () => value, set, use }
}

export type PrimerMode = 'collapsed' | 'expanded' | 'off'
export type Theme = 'system' | 'light' | 'sepia' | 'dark'
/** Typeface for the flash reader and its text view. */
export type ReadingFont = 'literata' | 'inter' | 'atkinson'

export interface Prefs {
  /** How "Before you read" primers appear for the next chapter. */
  primers: PrimerMode
  /** Books where the reader hid primers. */
  primersHidden: string[]
  /** Reading speed used for time estimates, in words per minute. */
  wpm: number
  /** Speed of the flash (one word at a time) reader. */
  rsvpWpm: number
  rsvpFont: ReadingFont
  theme: Theme
  /** Dismissed "make a reading plan?" prompts, per book. */
  planPromptDismissed: string[]
}

export const prefs = createStore<Prefs>('virgil:prefs:v1', {
  primers: 'collapsed',
  primersHidden: [],
  wpm: 230,
  rsvpWpm: 300,
  rsvpFont: 'literata',
  theme: 'system',
  planPromptDismissed: [],
})

const THEME_BG: Record<Exclude<Theme, 'system'>, string> = { light: '#f7f2e8', sepia: '#efe2cb', dark: '#17140f' }

export function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
  // The browser's own bars follow the theme too (two tags: one per OS scheme, both set when a theme is forced).
  const dark = matchMedia('(prefers-color-scheme: dark)').matches
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    const scheme = m.media?.includes('dark') ? 'dark' : 'light'
    m.content = theme === 'system' ? THEME_BG[scheme] : THEME_BG[theme]
  })
  void dark
}

export type Goal = { type: 'minutes'; minutes: number } | { type: 'date'; date: string }

export interface BookPlan {
  goal?: Goal
  /**
   * When each chapter was marked finished. `bulk` marks chapters unlocked in a
   * jump of two or more (catching Virgil up), which don't count toward pace or streak.
   */
  log: { chapter: number; at: string; bulk?: boolean }[]
}

export const plans = createStore<Record<string, BookPlan>>('virgil:plans:v1', {})

export function planFor(all: Record<string, BookPlan>, bookId: string): BookPlan {
  return all[bookId] ?? { log: [] }
}

export function updatePlan(bookId: string, update: (plan: BookPlan) => BookPlan) {
  plans.set((all) => ({ ...all, [bookId]: update(planFor(all, bookId)) }))
}

/** Keep the reading log in step with the bookmark. */
export function logBookmarkChange(bookId: string, from: number, to: number) {
  if (to === from) return
  const at = new Date().toISOString()
  updatePlan(bookId, (plan) => ({
    ...plan,
    log:
      to > from
        ? [
            ...plan.log.filter((e) => e.chapter <= from),
            ...Array.from({ length: to - from }, (_, i) => ({ chapter: from + 1 + i, at, ...(to - from > 1 ? { bulk: true } : {}) })),
          ]
        : plan.log.filter((e) => e.chapter <= to),
  }))
}

/** When the reader last had each book open, for the "welcome back" recap. */
export const visits = createStore<Record<string, string>>('virgil:visits:v1', {})

/** Recently opened search results, per book. */
export const recents = createStore<Record<string, { kind: string; id: string; label: string }[]>>('virgil:recent-search:v1', {})
