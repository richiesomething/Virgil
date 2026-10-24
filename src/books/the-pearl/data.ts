import type { BookData, Chapter, Character, Relationship } from '../../types'
import { meta } from './meta'
import chapters from './chapters.json'
import characters from './characters.json'
import relationships from './relationships.json'

const data: BookData = {
  meta,
  chapters: chapters as Chapter[],
  characters: characters as Character[],
  relationships: relationships as Relationship[],
}

export default data
