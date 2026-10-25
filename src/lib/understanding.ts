import type { Afterword, BookData, Character, Insight, Place, Theme, TimelineEvent } from '../types'
import { displayId, lookupCharacter } from './spoilers'
import { placeAt } from './atlas'

/**
 * Spoiler-gated queries for themes, insights, the afterword and the timeline.
 * Like spoilers.ts, every function takes `upTo` and never returns anything beyond it.
 */

export function themesUpTo(book: BookData, upTo: number): Theme[] {
  return (book.themes ?? []).filter((t) => t.from <= upTo)
}

export function themeAt(book: BookData, id: string, upTo: number): Theme | undefined {
  return themesUpTo(book, upTo).find((t) => t.id === id)
}

/** The theme as the reader understands it now. */
export function themeSummary(t: Theme, upTo: number): string {
  return [...t.summary].reverse().find((s) => s.from <= upTo)?.text ?? ''
}

/** How the reader's understanding of a theme has built up, stage by stage. */
export function themeStages(t: Theme, upTo: number) {
  return t.summary.filter((s) => s.from <= upTo)
}

/** Theme ids shown on an insight, dropping any the reader hasn't reached. */
const visibleThemes = (book: BookData, ids: string[], upTo: number) => ids.filter((id) => themeAt(book, id, upTo))

export function insightsForChapter(book: BookData, n: number, upTo: number): Insight[] {
  if (n > upTo) return []
  return (book.insights ?? []).filter((i) => i.chapter === n).map((i) => ({ ...i, themes: visibleThemes(book, i.themes, upTo) }))
}

export function insightsForTheme(book: BookData, themeId: string, upTo: number): Insight[] {
  return (book.insights ?? []).filter((i) => i.chapter <= upTo && i.themes.includes(themeId)).map((i) => ({ ...i, themes: visibleThemes(book, i.themes, upTo) }))
}

/** Themes most alive in the last few chapters read, for Today. */
export function activeThemes(book: BookData, upTo: number, limit = 4): Theme[] {
  const score = new Map<string, number>()
  for (const i of book.insights ?? []) {
    if (i.chapter > upTo) continue
    for (const id of i.themes) score.set(id, (score.get(id) ?? 0) + 1 + Math.max(0, 10 - (upTo - i.chapter)))
  }
  return themesUpTo(book, upTo)
    .sort((a, b) => (score.get(b.id) ?? 0) - (score.get(a.id) ?? 0))
    .slice(0, limit)
}

/** Only once the book is finished. */
export function afterwordFor(book: BookData, upTo: number): Afterword | undefined {
  return upTo >= book.meta.chapterCount ? book.afterword : undefined
}

export function hasTimeline(book: BookData): boolean {
  return !!book.timeline?.length
}

export interface TimelineView extends Omit<TimelineEvent, 'text' | 'people' | 'places'> {
  text: string
  people: Character[]
  places: Place[]
}

/** Events the reader knows about, with only the people and places they've met. */
export function timelineUpTo(book: BookData, upTo: number): TimelineView[] {
  return (book.timeline ?? [])
    .filter((e) => e.revealed <= upTo)
    .map((e) => {
      const people = [...new Set((e.people ?? []).map((id) => displayId(book, id, upTo)).filter((x): x is string => !!x))]
        .map((id) => lookupCharacter(book, id, upTo))
        .flatMap((r) => (r.status === 'visible' ? [r.character] : []))
      const places = [...new Set((e.places ?? []).map((id) => placeAt(book, id, upTo)).filter((p): p is Place => !!p))]
      return { ...e, text: [...e.text].reverse().find((t) => t.from <= upTo)?.text ?? '', people, places, chapters: e.chapters.filter((c) => c <= upTo) }
    })
}

export const insightLabel: Record<Insight['kind'], string> = {
  theme: 'Theme',
  motif: 'Motif',
  craft: 'Craft',
  context: 'Context',
  question: 'Think about',
}
