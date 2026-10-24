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

export interface Prefs {
  /** Show "Before you read" primers for the next chapter. */
  showPrimers: boolean
  /** Reading speed used for time estimates, in words per minute. */
  wpm: number
}

export const prefs = createStore<Prefs>('virgil:prefs:v1', { showPrimers: true, wpm: 230 })

export type Goal = { type: 'minutes'; minutes: number } | { type: 'date'; date: string }

export interface BookPlan {
  goal?: Goal
  /** When each chapter was marked finished (ISO timestamps). */
  log: { chapter: number; at: string }[]
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
        ? [...plan.log.filter((e) => e.chapter <= from), ...Array.from({ length: to - from }, (_, i) => ({ chapter: from + 1 + i, at }))]
        : plan.log.filter((e) => e.chapter <= to),
  }))
}

/** Visits, for the "welcome back" recap: when the reader last opened each book before this session. */
export const visits = createStore<Record<string, { last: string; previous?: string }>>('virgil:visits:v1', {})
