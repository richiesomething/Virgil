// Builds the app's copy of a book from its source folder.
//   data-src/<book>/  (book.json, chapters-*.json, characters-*.json, … — see docs/data-format.md)
//   → src/books/<book>/book.json   metadata, loaded up front for the library
//   → src/books/<book>/data.json   everything else, code-split per book
//   → src/books/<book>/atlas/*.json  map drawings (basemaps come from scripts/atlas/build-basemaps.mjs)
// Usage: node scripts/merge-data.mjs [book]   (no argument: every book in data-src/)
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const books = process.argv[2]
  ? [process.argv[2]]
  : readdirSync('data-src', { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(join('data-src', d.name, 'book.json')))
      .map((d) => d.name)

for (const book of books) mergeBook(book)

function mergeBook(book) {
  const dir = join('data-src', book)
  const outDir = join('src/books', book)
  mkdirSync(join(outDir, 'atlas'), { recursive: true })
  const json = (f) => JSON.parse(readFileSync(join(dir, f), 'utf8'))
  const has = (f) => existsSync(join(dir, f))
  const read = (pattern) =>
    readdirSync(dir)
      .filter((f) => pattern.test(f))
      .sort()
      .flatMap((f) => json(f))
  const log = []

  const meta = json('book.json')
  if (meta.id !== book) throw new Error(`data-src/${book}/book.json has id "${meta.id}"`)

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
  log.push(`${chapters.length} chapters`)

  // Lists the format lets authors leave out are filled in, so the app can rely on them.
  const characters = read(/^characters-\d+\.json$/)
    .map((c) => ({ ...c, aliases: c.aliases ?? [], tagline: c.tagline ?? [], description: c.description ?? [], moments: c.moments ?? [] }))
    .sort((a, b) => a.firstChapter - b.firstChapter || a.id.localeCompare(b.id))
  log.push(`${characters.length} characters`)

  // People's relationships and links to objects/places are kept in separate source files.
  const relationships = ['relationships.json', 'things-relationships.json'].filter(has).flatMap(json)

  // Glossary notes, deduplicated by term (earliest chapter wins; later ones become "see also").
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
  log.push(`${noteList.length} notes`)

  const primers = read(/^primers-\d+-\d+\.json$/).sort((a, b) => a.chapter - b.chapter)
  const recaps = has('recaps.json') ? json('recaps.json') : []
  const wordCounts = has('word-counts.json') ? json('word-counts.json') : []

  const data = { chapters, characters, relationships, notes: noteList, primers, recaps, wordCounts }

  // Atlas: frames and drawings (hand-authored) plus places/settings/journeys (one or more files, merged by id).
  const atlasDir = join(dir, 'atlas')
  if (existsSync(join(atlasDir, 'frames.json'))) {
    const frames = JSON.parse(readFileSync(join(atlasDir, 'frames.json'), 'utf8')).map(({ landmarks, recipe, ...f }) => f)
    const records = new Map()
    const settings = {}
    const journeys = []
    for (const f of readdirSync(dir).filter((f) => /^places-.*\.json$/.test(f)).sort()) {
      const d = json(f)
      for (const p of d.places) records.set(p.id, [...(records.get(p.id) ?? []), p])
      for (const [ch, ids] of Object.entries(d.settings ?? {})) settings[ch] = [...new Set([...(settings[ch] ?? []), ...ids])]
      journeys.push(...(d.journeys ?? []))
    }
    const used = new Set(Object.values(settings).flat())
    const places = [...records.values()]
      .map((recs) => {
        // The record that introduces the place wins for name, position and precision; the rest add to it.
        const [primary] = [...recs].sort((a, b) => a.firstChapter - b.firstChapter)
        const byFrom = new Map()
        for (const t of recs.flatMap((r) => r.tagline ?? [])) if (!byFrom.has(t.from)) byFrom.set(t.from, t)
        const aliases = new Map()
        for (const a of recs.flatMap((r) => r.aliases ?? [])) if (!aliases.has(a.name)) aliases.set(a.name, a)
        const xy = Object.assign({}, ...recs.map((r) => r.xy ?? {}).reverse(), primary.xy ?? {})
        const pick = (k) => primary[k] ?? recs.find((r) => r[k] != null)?.[k]
        return {
          id: primary.id,
          name: primary.name,
          // Whole-book role, for the data only: the app works out what the reader has seen with placeRole().
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
      })
      .sort((a, b) => a.firstChapter - b.firstChapter || a.id.localeCompare(b.id))
    const seen = new Set()
    for (const j of journeys) {
      while (seen.has(j.id)) j.id += '-2'
      seen.add(j.id)
    }
    // Glossary notes about a place point back at it.
    const byTerm = new Map(noteList.map((n) => [n.term, n]))
    for (const p of places) if (p.note && byTerm.has(p.note)) byTerm.get(p.note).placeId = p.id
    data.atlas = { frames, places, settings, journeys }
    log.push(`atlas: ${frames.length} frames, ${places.length} places, ${journeys.length} journeys`)
    // Drawings for plan frames ship as their own lazily loaded files.
    for (const f of readdirSync(atlasDir).filter((f) => /^art-.*\.json$/.test(f))) {
      writeFileSync(join(outDir, 'atlas', f.replace(/^art-/, '')), readFileSync(join(atlasDir, f), 'utf8'))
    }
  }

  // Understanding: themes, "what to notice" insights, the afterword and (some books) a timeline.
  if (has('themes.json')) data.themes = json('themes.json')
  const insights = read(/^notice-\d+-\d+\.json$/)
    .sort((a, b) => a.chapter - b.chapter)
    .map((n, i, all) => ({ id: `${n.chapter}-${all.slice(0, i).filter((m) => m.chapter === n.chapter).length + 1}`, ...n, themes: n.themes ?? [] }))
  if (insights.length) data.insights = insights
  if (has('afterword.json')) data.afterword = json('afterword.json')
  if (has('timeline.json')) data.timeline = json('timeline.json').events.sort((a, b) => a.date.localeCompare(b.date) || a.revealed - b.revealed)
  if (data.themes || insights.length) log.push(`${data.themes?.length ?? 0} themes, ${insights.length} insights${data.afterword ? ', afterword' : ''}${data.timeline ? `, ${data.timeline.length} timeline events` : ''}`)

  writeFileSync(join(outDir, 'book.json'), JSON.stringify(meta, null, 2) + '\n')
  writeFileSync(join(outDir, 'data.json'), JSON.stringify(data) + '\n')
  console.log(`✓ ${book}: ${log.join(' · ')}`)
}
