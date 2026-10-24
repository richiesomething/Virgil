import type { BookData, Chapter, Character, Note, Primer, Recap, Relationship } from '../../types'
import { meta } from './meta'
import chapters from './chapters.json'
import characters from './characters.json'
import relationships from './relationships.json'
import notes from './notes.json'
import primers from './primers.json'
import recaps from './recaps.json'
import wordCounts from './word-counts.json'

const data: BookData = {
  meta,
  chapters: chapters as Chapter[],
  characters: characters as Character[],
  relationships: relationships as Relationship[],
  notes: notes as Note[],
  primers: primers as Primer[],
  recaps: recaps as Recap[],
  wordCounts,
}

export default data
