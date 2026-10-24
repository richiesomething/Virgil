// Merges data-src/<book>/chapters-*.json and characters-*.json into src/books/<book>/.
// Usage: node scripts/merge-data.mjs monte-cristo
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const book = process.argv[2] ?? 'monte-cristo'
const dir = join('data-src', book)
const read = (pattern) =>
  readdirSync(dir)
    .filter((f) => pattern.test(f))
    .flatMap((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')))

const chapters = read(/^chapters-\d+-\d+\.json$/)
  .sort((a, b) => a.number - b.number)
  .map(({ number, title, volume, summary, details, characters }) => ({
    number,
    title,
    volume,
    summary,
    details,
    characters: [...new Set(characters)],
  }))
writeFileSync(join('src/books', book, 'chapters.json'), JSON.stringify(chapters, null, 2) + '\n')
console.log(`Wrote ${chapters.length} chapters for ${book}`)

const characters = read(/^characters-\d+\.json$/).sort(
  (a, b) => a.firstChapter - b.firstChapter || a.id.localeCompare(b.id),
)
if (characters.length) {
  writeFileSync(join('src/books', book, 'characters.json'), JSON.stringify(characters, null, 2) + '\n')
  console.log(`Wrote ${characters.length} characters for ${book}`)
} else if (!existsSync(join('src/books', book, 'characters.json'))) {
  console.warn('No characters-*.json found')
}

// People's relationships and links to objects/places are kept in separate source files.
const relationships = ['relationships.json', 'things-relationships.json']
  .filter((f) => existsSync(join(dir, f)))
  .flatMap((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')))
if (relationships.length) {
  writeFileSync(join('src/books', book, 'relationships.json'), JSON.stringify(relationships, null, 2) + '\n')
  console.log(`Wrote ${relationships.length} relationships for ${book}`)
}
