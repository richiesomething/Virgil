import type { Atlas, AtlasFrame, BookData, Character, Journey, JourneyLeg, Place } from '../types'
import { href, withQuery } from './router'
import { chapter, displayId, isThing, lookupCharacter } from './spoilers'

/**
 * Spoiler-gated queries for the physical map. Like spoilers.ts, every function takes `upTo`
 * (the chapter the view is showing) and never returns anything from later in the book.
 */

const empty: Atlas = { frames: [], places: [], settings: {}, journeys: [] }
const atlasOf = (book: BookData) => book.atlas ?? empty

export function hasAtlas(book: BookData): boolean {
  return !!book.atlas?.places.length
}

function rawPlace(book: BookData, id: string): Place | undefined {
  return atlasOf(book).places.find((p) => p.id === id)
}

/** The place the reader should see for `id` at `upTo` (following mergers), or undefined if not reached. */
export function placeAt(book: BookData, id: string, upTo: number, depth = 0): Place | undefined {
  const p = rawPlace(book, id)
  if (!p || p.firstChapter > upTo || depth > 8) return undefined
  if (p.mergedInto && p.mergedInto.from <= upTo) return placeAt(book, p.mergedInto.id, upTo, depth + 1)
  return p
}

export function visiblePlaces(book: BookData, upTo: number): Place[] {
  return cached(book, `places:${upTo}`, () => atlasOf(book).places.filter((p) => p.firstChapter <= upTo && !(p.mergedInto && p.mergedInto.from <= upTo)))
}

export function placeTagline(p: Place, upTo: number): string {
  return [...p.tagline].reverse().find((t) => t.from <= upTo)?.text ?? ''
}

export function placeAliases(p: Place, upTo: number): string[] {
  return (p.aliases ?? []).filter((a) => a.from <= upTo).map((a) => a.name)
}

/** Places where chapter n's scenes happen (main one first); empty for unread chapters. */
export function chapterSettings(book: BookData, n: number, upTo: number): Place[] {
  if (n > upTo) return []
  const out: Place[] = []
  for (const id of atlasOf(book).settings[String(n)] ?? []) {
    const p = placeAt(book, id, upTo)
    if (p && !out.includes(p)) out.push(p)
  }
  return out
}

/** Where the story is at the end of chapter `upTo`. */
export function currentPlace(book: BookData, upTo: number): Place | undefined {
  for (let n = upTo; n >= 1; n--) {
    const [p] = chapterSettings(book, n, upTo)
    if (p) return p
  }
  return undefined
}

// Per-bookmark caches: these are asked for on every zoom frame and keystroke.
const caches = new WeakMap<BookData, Map<string, unknown>>()
function cached<T>(book: BookData, key: string, make: () => T): T {
  let m = caches.get(book)
  if (!m) caches.set(book, (m = new Map()))
  if (!m.has(key)) {
    if (m.size > 200) m.clear()
    m.set(key, make())
  }
  return m.get(key) as T
}

/** Place id → chapters (≤ upTo) whose scenes happen there. */
function sceneIndex(book: BookData, upTo: number): Map<string, number[]> {
  return cached(book, `scenes:${upTo}`, () => {
    const idx = new Map<string, number[]>()
    for (let n = 1; n <= upTo; n++) for (const p of chapterSettings(book, n, upTo)) idx.set(p.id, [...(idx.get(p.id) ?? []), n])
    return idx
  })
}

export function chaptersAt(book: BookData, id: string, upTo: number): number[] {
  return sceneIndex(book, upTo).get(id) ?? []
}

/**
 * Whether the reader has seen a scene here yet (or in a place inside it). The stored role is
 * for the whole book, so it must never be shown directly.
 */
export function placeRole(book: BookData, p: Place, upTo: number): 'setting' | 'mentioned' {
  const idx = sceneIndex(book, upTo)
  if (idx.has(p.id)) return 'setting'
  return visiblePlaces(book, upTo).some((c) => c.parent === p.id && idx.has(c.id)) ? 'setting' : 'mentioned'
}

/** People who appear in chapters set at this place. */
export function peopleAt(book: BookData, id: string, upTo: number): Character[] {
  const ids = new Set<string>()
  for (const n of chaptersAt(book, id, upTo)) for (const raw of chapter(book, n, upTo)?.characters ?? []) {
    const d = displayId(book, raw, upTo)
    if (d) ids.add(d)
  }
  return book.characters.filter((c) => ids.has(c.id) && !isThing(c))
}

/** Places a character has been: settings of the chapters they appear in. */
export function placesOf(book: BookData, characterId: string, upTo: number): { place: Place; chapters: number[] }[] {
  const seen = new Map<string, { place: Place; chapters: number[] }>()
  for (let n = 1; n <= upTo; n++) {
    const ch = chapter(book, n, upTo)
    if (!ch || !ch.characters.some((raw) => displayId(book, raw, upTo) === characterId)) continue
    const [main] = chapterSettings(book, n, upTo)
    if (!main) continue
    const entry = seen.get(main.id) ?? { place: main, chapters: [] }
    entry.chapters.push(n)
    seen.set(main.id, entry)
  }
  return [...seen.values()]
}

// ---------- frames ----------

export function frameById(book: BookData, id: string): AtlasFrame | undefined {
  return atlasOf(book).frames.find((f) => f.id === id)
}

const inBounds = (f: AtlasFrame, [x, y]: [number, number]) =>
  !!f.bounds && x >= f.bounds[0][0] && x <= f.bounds[1][0] && y >= f.bounds[0][1] && y <= f.bounds[1][1]

/** Where a place sits in a frame, if it is drawn there at all. */
export function positionIn(f: AtlasFrame, p: Place): [number, number] | undefined {
  if (f.type === 'plan') return p.xy?.[f.id]
  return p.lonlat && inBounds(f, p.lonlat) ? p.lonlat : undefined
}

const frameArea = (f: AtlasFrame) => (f.bounds ? (f.bounds[1][0] - f.bounds[0][0]) * (f.bounds[1][1] - f.bounds[0][1]) : 0)

/** Frames that hold something the reader has reached (plus the frames above them). */
export function unlockedFrames(book: BookData, upTo: number): AtlasFrame[] {
  return cached(book, `frames:${upTo}`, () => computeUnlockedFrames(book, upTo))
}

function computeUnlockedFrames(book: BookData, upTo: number): AtlasFrame[] {
  const frames = atlasOf(book).frames
  const places = visiblePlaces(book, upTo)
  const open = new Set(frames.filter((f) => places.some((p) => positionIn(f, p))).map((f) => f.id))
  for (const id of [...open]) {
    let f = frameById(book, id)
    while (f?.parent) {
      open.add(f.parent)
      f = frameById(book, f.parent)
    }
  }
  // Parents first, then their children, in authoring order.
  const ordered: AtlasFrame[] = []
  const visit = (parent?: string) => {
    for (const f of frames.filter((x) => x.parent === parent && open.has(x.id))) {
      ordered.push(f)
      visit(f.id)
    }
  }
  visit(undefined)
  for (const f of frames) if (open.has(f.id) && !ordered.includes(f)) ordered.push(f)
  return ordered
}

/** The most detailed unlocked frame showing a place: drawings first, then the smallest real map. */
export function bestFrame(book: BookData, p: Place, upTo: number): AtlasFrame | undefined {
  const frames = unlockedFrames(book, upTo).filter((f) => positionIn(f, p))
  return frames.find((f) => f.type === 'plan') ?? frames.sort((a, b) => frameArea(a) - frameArea(b))[0]
}

export function childFrames(book: BookData, f: AtlasFrame, upTo: number): AtlasFrame[] {
  return unlockedFrames(book, upTo).filter((c) => c.parent === f.id || c.offmap?.frame === f.id)
}

/** True when a place in frame f is better shown by one of its unlocked child frames. */
export function coveredByChild(book: BookData, f: AtlasFrame, p: Place, upTo: number): AtlasFrame | undefined {
  for (const c of childFrames(book, f, upTo)) {
    if (c.offmap?.frame === f.id) continue
    if (c.place === p.id) return c
    if (c.type === 'geo' && p.lonlat && inBounds(c, p.lonlat)) return c
    if (c.type === 'plan' && p.xy?.[c.id] && c.anchor && p.lonlat && f.bounds) {
      const span = f.bounds[1][0] - f.bounds[0][0]
      if (Math.hypot(p.lonlat[0] - c.anchor[0], p.lonlat[1] - c.anchor[1]) < span * 0.04) return c
    }
  }
  return undefined
}

/** Reached places that no frame can show: unknown locations, or real ones beyond every map. */
export function offMapPlaces(book: BookData, upTo: number): Place[] {
  const frames = atlasOf(book).frames
  return visiblePlaces(book, upTo).filter((p) => !frames.some((f) => positionIn(f, p)))
}

// ---------- journeys ----------

export interface VisibleLeg extends JourneyLeg {
  journey: Journey
  fromPlace: Place
  toPlace: Place
}

/** Journey legs up to `upTo`, between places the reader knows, with only the travellers they've met. */
export function visibleJourneys(book: BookData, upTo: number): { journey: Journey; who: Character[]; legs: VisibleLeg[] }[] {
  const out = []
  for (const j of atlasOf(book).journeys) {
    const legs: VisibleLeg[] = []
    for (const l of j.legs) {
      if (l.chapter > upTo) continue
      const fromPlace = placeAt(book, l.from, upTo)
      const toPlace = placeAt(book, l.to, upTo)
      if (fromPlace && toPlace && fromPlace !== toPlace) legs.push({ ...l, journey: j, fromPlace, toPlace })
    }
    if (!legs.length) continue
    const who = [...new Set(j.who.map((id) => displayId(book, id, upTo)).filter((x): x is string => !!x))]
      .map((id) => lookupCharacter(book, id, upTo))
      .flatMap((r) => (r.status === 'visible' ? [r.character] : []))
    out.push({ journey: j, who, legs })
  }
  return out
}

export const precisionLabel: Record<Place['precision'], string> = {
  exact: 'Real place',
  approximate: 'Approximate location',
  fictional: 'Fictional — placed where the book puts it',
  unknown: 'The book never says where',
}

/**
 * For the "Before you read" primer of the next chapter: its main setting, but only when the
 * reader already knows that place (the primer's own text names it). Never a new place.
 */
export function upcomingSetting(book: BookData, n: number, upTo: number): Place | undefined {
  if (n !== upTo + 1) return undefined
  const id = atlasOf(book).settings[String(n)]?.[0]
  return id ? placeAt(book, id, upTo) : undefined
}

/** 1–3, 7 style summary of the chapters a place appears in. */
export function chapterRange(chs: number[]): string {
  if (!chs.length) return ''
  const runs: string[] = []
  let start = chs[0]
  let prev = chs[0]
  for (const c of [...chs.slice(1), Infinity]) {
    if (c === prev + 1) {
      prev = c
      continue
    }
    runs.push(start === prev ? `${start}` : `${start}–${prev}`)
    start = prev = c
  }
  return (chs.length === 1 ? 'Ch ' : 'Chs ') + runs.join(', ')
}

/** Link to the atlas, optionally focused on a place and frame. */
export function atlasHref(bookId: string, opts: { place?: string; frame?: string } = {}) {
  return withQuery(href('b', bookId, 'cast'), { seg: 'places', view: 'map', place: opts.place, frame: opts.frame })
}
