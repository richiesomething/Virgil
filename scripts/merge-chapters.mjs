// Merges data-src/<book>/chapters-*.json into src/books/<book>/chapters.json.
// Usage: node scripts/merge-chapters.mjs monte-cristo
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const book = process.argv[2] ?? 'monte-cristo'
const dir = join('data-src', book)
const chapters = readdirSync(dir)
  .filter((f) => /^chapters-\d+-\d+\.json$/.test(f))
  .flatMap((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')))
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
