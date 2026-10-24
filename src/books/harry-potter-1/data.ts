import type { BookData, Chapter, Character } from '../../types'
import { meta } from './meta'
import chapters from './chapters.json'
import characters from './characters.json'

const data: BookData = {
  meta,
  chapters: chapters as Chapter[],
  characters: characters as Character[],
}

export default data
