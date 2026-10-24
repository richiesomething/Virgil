/** A piece of information that only becomes known to the reader at a given chapter. */
export interface Revealed {
  /** First chapter (1-based) at the end of which the reader knows this. */
  from: number
  text: string
}

export interface Chapter {
  number: number
  /** Empty for books whose chapters are only numbered. */
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

/** Characters are people (or creatures); objects and places can matter to a story too. */
export type Kind = 'character' | 'object' | 'place'

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
  /** Defaults to 'character'. */
  kind?: Kind
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
  /** True when word counts are estimates (no source text available). */
  wordCountsApproximate?: boolean
}

export interface BookData {
  meta: BookMeta
  chapters: Chapter[]
  characters: Character[]
  relationships: Relationship[]
  notes: Note[]
  primers: Primer[]
  recaps: Recap[]
  /** Words per chapter, index 0 = chapter 1. */
  wordCounts: number[]
}

/** 'tie' is used for every link that involves an object or place. */
export type RelationType = 'family' | 'love' | 'friend' | 'enemy' | 'work' | 'tie'

/**
 * A relationship between two characters as the reader understands it. Each state
 * becomes visible at its chapter; the latest reached state is the current one.
 */
/** How `a` is related to `b`: 'parent' means a is b's parent. */
export type Kin = 'parent' | 'child' | 'sibling' | 'spouse' | 'grandparent' | 'grandchild' | 'relative'

export interface RelationshipState {
  from: number
  type: RelationType
  label: string
  /** Set on family ties and marriages; drives the map's family view. */
  kin?: Kin
}

export interface Relationship {
  a: string
  b: string
  states: RelationshipState[]
}

export type NoteKind = 'word' | 'title' | 'money' | 'history' | 'reference' | 'foreign' | 'custom' | 'place' | 'lore'

/** A glossary/context note, shown from the chapter where the reader first meets the term. */
export interface Note {
  id: string
  term: string
  kind: NoteKind
  chapter: number
  text: string
  /** A short phrase from the text (public-domain books only). */
  quote?: string
  /** Later chapters where the term matters again. */
  seeAlso?: number[]
}

/** "Before you read": orientation for a chapter, safe to read before it. */
export interface Primer {
  chapter: number
  setting: string
  keepInMind: string
  returning: { id: string; reminder: string }[]
}

/** A "story so far" recap of chapters 1..through. */
export interface Recap {
  through: number
  title: string
  text: string[]
}
