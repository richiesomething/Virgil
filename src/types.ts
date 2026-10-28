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
  /** For tight spaces like the header; defaults to the title. */
  shortTitle?: string
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
  /** Position in the library. */
  order?: number
  /** 'text': built from the book's own text; 'knowledge': from what's known about it (no text). */
  source?: 'text' | 'knowledge'
  /**
   * The book's text for the reader. 'shipped': public-domain chapter files at public/texts/<id>/.
   * 'upload' (or no field): the reader adds their own copy (EPUB, PDF or text), kept on the device.
   */
  text?: { status: 'shipped' | 'upload'; edition?: string; license?: string; sourceUrl?: string }
  /**
   * A public-domain audiobook aligned to the text (docs/reading-spec.md §6). Chapter n streams from
   * `https://archive.org/download/<item>/<filePattern with NNN>`; public/texts/<id>/sync/NNN.json has a start time per word.
   */
  audio?: { status: 'shipped'; source: 'archive.org'; item: string; filePattern: string; reader: string; license: string; url: string }
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
  atlas?: Atlas
  themes?: Theme[]
  insights?: Insight[]
  afterword?: Afterword
  timeline?: TimelineEvent[]
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
  /** The Atlas place this note is about. */
  placeId?: string
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

/** One map surface: real geography (lon/lat) or our own drawing (x/y). */
export interface AtlasFrame {
  id: string
  type: 'geo' | 'plan'
  title: string
  short: string
  parent?: string
  /** geo: [[west, south], [east, north]] */
  bounds?: [[number, number], [number, number]]
  /** geo: mercator (default), or equirectangular for whole-world and polar maps. */
  projection?: 'mercator' | 'equirectangular'
  /** plan: drawing size */
  size?: [number, number]
  /** Where a child frame sits in its parent (lon/lat or x/y in the parent's space). */
  anchor?: [number, number]
  /** For frames whose real location is unknown: an edge marker in another frame. */
  offmap?: { frame: string; dir: 'N' | 'S' | 'E' | 'W'; label: string; badge?: string }
  /** The place this frame is a close-up of (its pin gives way to the frame's badge). */
  place?: string
  note?: string
  labels?: MapLabel[]
}

export interface MapLabel {
  text: string
  at: [number, number]
  kind: 'sea' | 'region' | 'area' | 'water' | 'minor' | 'floor' | 'street'
  rot?: number
  /** Only drawn once the reader has reached this chapter. */
  from?: number
}

/** A drawing (plan frame) or base geography (geo frame), loaded on demand. */
export interface FrameArt {
  bg: string
  features?: { k: string; poly?: [number, number][]; line?: [number, number][]; at?: [number, number]; r?: number; curve?: boolean; w?: number; from?: number }[]
  labels?: MapLabel[]
  land?: [number, number][][][]
  water?: [number, number][][][]
  parks?: [number, number][][][]
  rivers?: { line: [number, number][]; w?: number; curve?: boolean }[]
  walls?: [number, number][][]
}

export type Precision = 'exact' | 'approximate' | 'fictional' | 'unknown'

export interface Place {
  id: string
  name: string
  role: 'setting' | 'mentioned'
  firstChapter: number
  precision: Precision
  lonlat?: [number, number]
  radiusKm?: number
  xy?: Record<string, [number, number]>
  parent?: string
  today?: string
  note?: string
  tagline: Revealed[]
  aliases?: Alias[]
  mergedInto?: { id: string; from: number }
}

export interface JourneyLeg {
  chapter: number
  from: string
  to: string
  mode: string
  via?: [number, number][]
}

export interface Journey {
  id: string
  name: string
  who: string[]
  legs: JourneyLeg[]
}

export interface Atlas {
  frames: AtlasFrame[]
  places: Place[]
  /** Chapter number → place ids where its scenes happen, main one first. */
  settings: Record<string, string[]>
  journeys: Journey[]
}

/** A big idea the book keeps returning to; its summary grows as the reader does. */
export interface Theme {
  id: string
  name: string
  from: number
  summary: Revealed[]
}

export type InsightKind = 'theme' | 'motif' | 'craft' | 'context' | 'question'

/** "What to notice" in a chapter. */
export interface Insight {
  id: string
  chapter: number
  kind: InsightKind
  title: string
  text: string
  themes: string[]
}

/** "After you finish": shown only once the book is finished. */
export interface Afterword {
  ending: string[]
  themes: { theme: string; text: string }[]
  interpretations: { title: string; text: string }[]
  context: { title: string; text: string }[]
  adaptations: { title: string; year: number; kind: string; note: string }[]
  readNext: { title: string; author: string; why: string }[]
  questions: string[]
}

export interface TimelineEvent {
  id: string
  date: string
  label: string
  approx?: boolean
  title: string
  text: Revealed[]
  /** First chapter at the end of which the reader knows this happened. */
  revealed: number
  chapters: number[]
  flashback?: boolean
  places?: string[]
  people?: string[]
}

/** data-src/<book>/reveals.json: something the reader learns late. Read by the validator only; never shipped. */
export interface Reveal {
  id: string
  /** First chapter at the end of which the reader knows it. */
  chapter: number
  secret: string
  /** Words that give it away; none may appear in anything shown before `chapter`. */
  terms?: string[]
}
