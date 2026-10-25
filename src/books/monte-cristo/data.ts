import type { Afterword, Atlas, BookData, Insight, Theme, TimelineEvent, Chapter, Character, Note, Primer, Recap, Relationship } from '../../types'
import { meta } from './meta'
import chapters from './chapters.json'
import characters from './characters.json'
import relationships from './relationships.json'
import notes from './notes.json'
import primers from './primers.json'
import recaps from './recaps.json'
import wordCounts from './word-counts.json'
import atlas from './atlas.json'
import understanding from './understanding.json'

const data: BookData = {
  meta,
  chapters: chapters as Chapter[],
  characters: characters as Character[],
  relationships: relationships as Relationship[],
  notes: notes as Note[],
  primers: primers as Primer[],
  recaps: recaps as Recap[],
  wordCounts,
  atlas: atlas as unknown as Atlas,
  ...(understanding as unknown as { themes?: Theme[]; insights?: Insight[]; afterword?: Afterword; timeline?: TimelineEvent[] }),
}

export default data
