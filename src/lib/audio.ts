// A public-domain narration lined up with the text: one start time per token (scripts/audio/sync.mjs),
// streamed chapter by chapter from archive.org. One shared <audio> element lives for the whole session,
// so playback carries on across chapter changes and when the screen locks.
import type { BookData, BookMeta } from '../types'

export interface Sync {
  /** Seconds of audio in the chapter file. */
  duration: number
  /** Start of the first token and end of the last, in seconds (the file has an announcement before and after). */
  start: number
  end: number
  /** Start time of each token, in seconds. */
  times: Float64Array
}

export const hasAudio = (meta: BookMeta) => meta.audio?.status === 'shipped'

export function audioUrl(meta: BookMeta, n: number): string {
  const a = meta.audio!
  return `https://archive.org/download/${a.item}/${a.filePattern.replace('NNN', String(n).padStart(3, '0'))}`
}

const syncs = new Map<string, Promise<Sync>>()

/** The chapter's word timings. Rejects when the narration hasn't been lined up for it (yet). */
export function getSync(bookId: string, n: number): Promise<Sync> {
  const key = `${bookId}/${n}`
  if (!syncs.has(key)) {
    const p = fetch(`${import.meta.env.BASE_URL}texts/${bookId}/sync/${String(n).padStart(3, '0')}.json`)
      .then(async (res) => {
        if (!res.ok) throw new Error('No narration timing for this chapter')
        const raw = (await res.json()) as { duration: number; start: number; end: number; d: number[] }
        const times = new Float64Array(raw.d.length)
        let t = 0
        raw.d.forEach((d, i) => (times[i] = (t += d) / 1000))
        return { duration: raw.duration, start: raw.start / 1000, end: raw.end / 1000, times }
      })
      .catch((e) => {
        syncs.delete(key)
        throw e
      })
    syncs.set(key, p)
  }
  return syncs.get(key)!
}

/** Chapter durations in seconds (public/texts/<id>/audio.json), for the time left in the book. */
const durations = new Map<string, Promise<number[] | null>>()
export function getDurations(bookId: string): Promise<number[] | null> {
  if (!durations.has(bookId))
    durations.set(
      bookId,
      fetch(`${import.meta.env.BASE_URL}texts/${bookId}/audio.json`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => (j?.durations as number[]) ?? null)
        .catch(() => null),
    )
  return durations.get(bookId)!
}

/** The token being spoken at `t` seconds: the last one that has started. */
export function tokenAt(sync: Sync, t: number): number {
  const a = sync.times
  let lo = 0
  let hi = a.length - 1
  if (t < a[0]) return 0
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (a[mid] <= t) lo = mid
    else hi = mid - 1
  }
  return lo
}

export const timeOf = (sync: Sync, i: number) => sync.times[Math.max(0, Math.min(sync.times.length - 1, i))]

/** Seconds of narration left in the book from token `i` of chapter `n`, at the given rate. */
export function narrationLeft(book: BookData, sync: Sync, n: number, i: number, rate: number, durs: number[] | null): { chapter: number; book: number } {
  const chapterLeft = Math.max(0, sync.end - timeOf(sync, i))
  const rest = durs ? durs.slice(n).reduce((a, b) => a + b, 0) : book.wordCounts.slice(n).reduce((a, b) => a + b, 0) / (150 / 60) // ~150 words a minute spoken
  return { chapter: chapterLeft / rate, book: (chapterLeft + rest) / rate }
}

// ── The one audio element ────────────────────────────────────────────────

let el: HTMLAudioElement | null = null

export function player(): HTMLAudioElement {
  if (!el) {
    el = new Audio()
    el.preload = 'metadata'
    ;(el as HTMLAudioElement & { playsInline?: boolean }).playsInline = true
    ;(window as Window & { __virgilPlayer?: HTMLAudioElement }).__virgilPlayer = el // for tests and debugging
  }
  return el
}

/** Point the player at a chapter without restarting it if it's already there. */
export function loadChapter(url: string) {
  const p = player()
  if (p.src !== url) {
    p.src = url
    p.load()
  }
  return p
}

/** Set once per chapter: lock-screen and headphone controls. */
export function mediaSession(meta: { title: string; artist: string; album: string }, handlers: Partial<Record<'play' | 'pause' | 'seekbackward' | 'seekforward' | 'previoustrack' | 'nexttrack', () => void>>) {
  const ms = navigator.mediaSession
  if (!ms) return
  try {
    ms.metadata = new MediaMetadata({ ...meta, artwork: [{ src: `${import.meta.env.BASE_URL}icon-512.png`, sizes: '512x512', type: 'image/png' }] })
    for (const action of ['play', 'pause', 'seekbackward', 'seekforward', 'previoustrack', 'nexttrack'] as const) {
      try {
        ms.setActionHandler(action, handlers[action] ?? null)
      } catch {
        // not every browser supports every action
      }
    }
  } catch {
    // no media session
  }
}

export function mediaPosition(duration: number, position: number, rate: number) {
  try {
    navigator.mediaSession?.setPositionState?.({ duration, position: Math.min(duration, Math.max(0, position)), playbackRate: rate })
  } catch {
    // ignore
  }
}

/** Set when a chapter ends in Listen mode and the next one starts playing before its page mounts. */
export let autoplayNext: { bookId: string; n: number } | null = null
export const setAutoplayNext = (v: typeof autoplayNext) => (autoplayNext = v)
