// A public-domain narration lined up with the text: one start time per token (scripts/audio/sync.mjs),
// streamed chapter by chapter from archive.org. One shared <audio> element lives for the whole session,
// so playback carries on across chapter changes and when the screen locks.
import type { BookData, BookMeta } from '../types'

/**
 * A chapter's narration lives on a virtual timeline made of one or more files laid end to end: `files[k]` starts at
 * `offsets[k]` seconds. Most books have one file per chapter; LibriVox group recordings often put several short
 * chapters in one file, or split a long chapter over several.
 */
export interface Sync {
  /** Seconds on the chapter's timeline (all its files together). */
  duration: number
  /** Start of the first token and end of the last, in seconds on that timeline. */
  start: number
  end: number
  /** Start time of each token, in seconds on that timeline. */
  times: Float64Array
  /** archive.org paths ("item/file.mp3") in order. */
  files: string[]
  /** Where each file starts on the timeline (offsets[0] is 0). */
  offsets: number[]
}

export const hasAudio = (meta: BookMeta) => meta.audio?.status === 'shipped'

/** A file's URL from its archive.org path (or a full URL, passed through). */
export const fileUrl = (file: string) => (/^https?:/.test(file) ? file : `https://archive.org/download/${file}`)

/** The one file of chapter n for books with a file pattern (one file per chapter); null for books whose syncs name their files. */
export function chapterFile(meta: BookMeta, n: number): string | null {
  const a = meta.audio
  if (!a?.item || !a.filePattern) return null
  const name = a.filePattern.includes('NNN') ? a.filePattern.replace('NNN', String(n).padStart(3, '0')) : a.filePattern.replace('NN', String(n).padStart(2, '0'))
  return `${a.item}/${name}`
}

/** Which of the chapter's files is playing at timeline second `t`, and the time inside it. */
export function locate(sync: Sync, t: number): { file: number; local: number } {
  let k = 0
  while (k + 1 < sync.offsets.length && sync.offsets[k + 1] <= t) k++
  return { file: k, local: Math.max(0, t - sync.offsets[k]) }
}

/** Index of the chapter file the player has loaded (by its URL), or -1 if it's playing something else. */
export function fileIndexOf(sync: Sync, src: string): number {
  return sync.files.findIndex((f) => fileUrl(f) === src)
}

const syncs = new Map<string, Promise<Sync>>()
const ready = new Map<string, Sync>()

/** A sync that has already loaded (prefetched near the end of the previous chapter), or null. */
export const peekSync = (bookId: string, n: number) => ready.get(`${bookId}/${n}`) ?? null

/** The chapter's word timings. Rejects when the narration hasn't been lined up for it (yet). */
export function getSync(meta: BookMeta, n: number): Promise<Sync> {
  const bookId = meta.id
  const key = `${bookId}/${n}`
  if (!syncs.has(key)) {
    const p = fetch(`${import.meta.env.BASE_URL}texts/${bookId}/sync/${String(n).padStart(3, '0')}.json`)
      .then(async (res) => {
        if (!res.ok) throw new Error('No narration timing for this chapter')
        const raw = (await res.json()) as { duration: number; start: number; end: number; d: number[]; files?: string[]; offsets?: number[] }
        const times = new Float64Array(raw.d.length)
        let t = 0
        raw.d.forEach((d, i) => (times[i] = (t += d) / 1000))
        const files = raw.files ?? [chapterFile(meta, n) ?? '']
        const offsets = raw.offsets ?? [0]
        const sync: Sync = { duration: raw.duration, start: raw.start / 1000, end: raw.end / 1000, times, files, offsets }
        ready.set(key, sync)
        return sync
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
  // Chapters without a measured duration are estimated at ~150 spoken words a minute.
  const rest = book.wordCounts.slice(n).reduce((a, w, i) => a + (durs?.[n + i] ?? w / 2.5), 0)
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

/** Point the player at a file without restarting it if it's already there. */
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
