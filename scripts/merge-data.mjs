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

// Reading guide: notes (deduplicated by term, earliest chapter wins), primers, recaps, word counts.
const slug = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const rawNotes = read(/^notes-\d+-\d+\.json$/).sort((a, b) => a.chapter - b.chapter)
const notes = new Map()
for (const n of rawNotes) {
  const id = slug(n.term)
  const prev = notes.get(id)
  if (!prev) {
    notes.set(id, { id, term: n.term, kind: n.kind, chapter: n.chapter, text: n.text, ...(n.quote ? { quote: n.quote } : {}), seeAlso: [...(n.seeAlso ?? [])] })
  } else {
    prev.seeAlso = [...new Set([...prev.seeAlso, n.chapter, ...(n.seeAlso ?? [])])].filter((c) => c > prev.chapter).sort((a, b) => a - b)
  }
}
const noteList = [...notes.values()].map((n) => (n.seeAlso.length ? n : (({ seeAlso, ...rest }) => rest)(n)))
if (rawNotes.length) {
  writeFileSync(join('src/books', book, 'notes.json'), JSON.stringify(noteList, null, 2) + '\n')
  console.log(`Wrote ${noteList.length} notes for ${book} (${rawNotes.length - noteList.length} duplicates merged)`)
}
const primers = read(/^primers-\d+-\d+\.json$/).sort((a, b) => a.chapter - b.chapter)
if (primers.length) {
  writeFileSync(join('src/books', book, 'primers.json'), JSON.stringify(primers, null, 2) + '\n')
  console.log(`Wrote ${primers.length} primers for ${book}`)
}
for (const f of ['recaps.json', 'word-counts.json']) {
  if (existsSync(join(dir, f))) writeFileSync(join('src/books', book, f), readFileSync(join(dir, f), 'utf8'))
}
