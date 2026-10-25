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

// Atlas: frames + plan art (hand-authored) and places/settings/journeys (one or more files, merged by id).
const atlasDir = join(dir, 'atlas')
if (existsSync(join(atlasDir, 'frames.json'))) {
  const frames = JSON.parse(readFileSync(join(atlasDir, 'frames.json'), 'utf8')).map(({ landmarks, ...f }) => f)
  const files = readdirSync(dir).filter((f) => /^places-.*\.json$/.test(f)).sort()
  const records = new Map()
  const settings = {}
  const journeys = []
  for (const f of files) {
    const d = JSON.parse(readFileSync(join(dir, f), 'utf8'))
    for (const p of d.places) records.set(p.id, [...(records.get(p.id) ?? []), p])
    for (const [ch, ids] of Object.entries(d.settings ?? {})) settings[ch] = [...new Set([...(settings[ch] ?? []), ...ids])]
    journeys.push(...(d.journeys ?? []))
  }
  const used = new Set(Object.values(settings).flat())
  const places = [...records.values()].map((recs) => {
    // The record that introduces the place wins for name, position and precision; the rest add to it.
    const [primary] = [...recs].sort((a, b) => a.firstChapter - b.firstChapter)
    const byFrom = new Map()
    for (const t of recs.flatMap((r) => r.tagline ?? [])) if (!byFrom.has(t.from)) byFrom.set(t.from, t)
    const aliases = new Map()
    for (const a of recs.flatMap((r) => r.aliases ?? [])) if (!aliases.has(a.name)) aliases.set(a.name, a)
    const xy = Object.assign({}, ...recs.map((r) => r.xy ?? {}).reverse(), primary.xy ?? {})
    const pick = (k) => primary[k] ?? recs.find((r) => r[k] != null)?.[k]
    const place = {
      id: primary.id,
      name: primary.name,
      role: used.has(primary.id) || recs.some((r) => r.role === 'setting') ? 'setting' : 'mentioned',
      firstChapter: primary.firstChapter,
      precision: primary.precision,
      ...(primary.lonlat ? { lonlat: primary.lonlat } : {}),
      ...(primary.radiusKm ? { radiusKm: primary.radiusKm } : {}),
      ...(Object.keys(xy).length ? { xy } : {}),
      ...(pick('parent') ? { parent: pick('parent') } : {}),
      ...(pick('today') ? { today: pick('today') } : {}),
      ...(pick('note') ? { note: pick('note') } : {}),
      tagline: [...byFrom.values()].sort((a, b) => a.from - b.from),
      ...(aliases.size ? { aliases: [...aliases.values()].sort((a, b) => a.from - b.from) } : {}),
      ...(pick('mergedInto') ? { mergedInto: pick('mergedInto') } : {}),
    }
    return place
  }).sort((a, b) => a.firstChapter - b.firstChapter || a.id.localeCompare(b.id))
  const seen = new Set()
  for (const j of journeys) {
    while (seen.has(j.id)) j.id += '-2'
    seen.add(j.id)
  }
  // Glossary notes about a place point back at it.
  const byTerm = new Map(noteList.map((n) => [n.term, n]))
  for (const p of places) if (p.note && byTerm.has(p.note)) byTerm.get(p.note).placeId = p.id
  if (rawNotes.length) writeFileSync(join('src/books', book, 'notes.json'), JSON.stringify(noteList, null, 2) + '\n')
  const atlas = { frames, places, settings, journeys }
  writeFileSync(join('src/books', book, 'atlas.json'), JSON.stringify(atlas, null, 1) + '\n')
  console.log(`Wrote atlas for ${book}: ${frames.length} frames, ${places.length} places, ${journeys.length} journeys`)
  // Plan-frame drawings ship as their own lazily loaded files.
  for (const f of readdirSync(atlasDir).filter((f) => /^art-.*\.json$/.test(f))) {
    writeFileSync(join('src/books', book, 'atlas', f.replace(/^art-/, '')), readFileSync(join(atlasDir, f), 'utf8'))
  }
}
