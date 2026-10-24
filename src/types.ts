/** A piece of information that only becomes known to the reader at a given chapter. */
export interface Revealed {
  /** First chapter (1-based) at the end of which the reader knows this. */
  from: number
  text: string
}

export interface Chapter {
  number: number
  title: string
  /** Omitted for books that aren't divided into volumes. */
  volume?: number
  /** One or two sentences. */
  summary: string
  /** Longer summary, as paragraphs. */
  details: string[]
  /** Ids of characters who appear in (or are meaningfully discussed in) the chapter. */
  characters: string[]
}

export type Importance = 'major' | 'supporting' | 'minor'

export interface Alias {
  name: string
  from: number
  note?: string
}

export interface Moment {
  chapter: number
  text: string
}

export interface Character {
  id: string
  /** The name the reader first knows them by — must be spoiler-safe at `firstChapter`. */
  name: string
  firstChapter: number
  importance: Importance
  group: string
  /** Other names and titles, each revealed at a chapter. */
  aliases: Alias[]
  /** Short "who is this?" lines; the latest one the reader has reached is shown. */
  tagline: Revealed[]
  /** Profile paragraphs; every one the reader has reached is shown, in order. */
  description: Revealed[]
  moments: Moment[]
  /**
   * When the reader learns this "character" is really someone else (a disguise or
   * secret identity), from that chapter on it folds into the other character.
   */
  mergedInto?: { id: string; from: number }
}

export interface BookMeta {
  id: string
  title: string
  author: string
  year: number
  chapterCount: number
  blurb: string
  edition: string
  /** Link to a public-domain source text, when there is one. */
  sourceUrl?: string
  /** Empty for books that aren't divided into volumes. */
  volumes: { number: number; title: string; firstChapter: number }[]
  /** Accent colour for the cover. */
  color: string
}

export interface BookData {
  meta: BookMeta
  chapters: Chapter[]
  characters: Character[]
  relationships: Relationship[]
}

export type RelationType = 'family' | 'love' | 'friend' | 'enemy' | 'work'

/**
 * A relationship between two characters as the reader understands it. Each state
 * becomes visible at its chapter; the latest reached state is the current one.
 */
export interface Relationship {
  a: string
  b: string
  states: { from: number; type: RelationType; label: string }[]
}
