// Checks book data for structural mistakes and spoiler leaks. Run by `npm run build`.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = 'src/books'
let errors = 0
const fail = (book, msg) => {
  errors++
  console.error(`✗ [${book}] ${msg}`)
}

for (const book of readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)) {
  if (!existsSync(join(root, book, 'book.json')) || !existsSync(join(root, book, 'data.json'))) {
    fail(book, 'missing book.json or data.json (run node scripts/merge-data.mjs)')
    continue
  }
  const meta = JSON.parse(readFileSync(join(root, book, 'book.json'), 'utf8'))
  const data = JSON.parse(readFileSync(join(root, book, 'data.json'), 'utf8'))
  // Each part of the book by its old file name, so the checks below read naturally.
  const parts = {
    'chapters.json': data.chapters,
    'characters.json': data.characters,
    'relationships.json': data.relationships?.length ? data.relationships : undefined,
    'notes.json': data.notes?.length ? data.notes : undefined,
    'primers.json': data.primers?.length ? data.primers : undefined,
    'recaps.json': data.recaps?.length ? data.recaps : undefined,
    'word-counts.json': data.wordCounts?.length ? data.wordCounts : undefined,
    'atlas.json': data.atlas,
    'understanding.json': data.themes || data.insights || data.afterword || data.timeline ? { themes: data.themes, insights: data.insights, afterword: data.afterword, timeline: data.timeline } : undefined,
  }
  const load = (f) => parts[f]
  const exists = (f) => parts[f] !== undefined
  const chapters = load('chapters.json')
  const characters = load('characters.json')
  const count = meta.chapterCount
  for (const k of ['id', 'title', 'author', 'year', 'chapterCount', 'blurb', 'edition', 'color']) if (meta[k] === undefined || meta[k] === '') fail(book, `book.json is missing ${k}`)
  // Shipped text: every chapter file and a manifest that agrees with the chapter count.
  if (meta.text?.status === 'shipped') {
    const tdir = join('public', 'texts', book)
    const manifest = existsSync(join(tdir, 'manifest.json')) ? JSON.parse(readFileSync(join(tdir, 'manifest.json'), 'utf8')) : null
    if (!manifest) fail(book, `text.status is "shipped" but ${tdir}/manifest.json is missing (run scripts/pipeline/export-text.mjs)`)
    else if (manifest.chapters !== count) fail(book, `public/texts manifest has ${manifest.chapters} chapters, book.json says ${count}`)
    for (let n = 1; n <= count; n++) if (!existsSync(join(tdir, `${String(n).padStart(3, '0')}.txt`))) fail(book, `public/texts/${book}/${String(n).padStart(3, '0')}.txt is missing`)
  } else if (meta.text && meta.text.status !== 'upload') fail(book, `book.json text.status must be "shipped" or "upload"`)
  // Narration: a manifest, and a timing file for every chapter it says is synced (a partial set is allowed while the alignment runs).
  if (meta.audio) {
    const tdir = join('public', 'texts', book)
    if (!meta.audio.item || !meta.audio.filePattern?.includes('NNN') || !meta.audio.reader) fail(book, 'book.json audio needs item, filePattern (with NNN) and reader')
    const manifest = existsSync(join(tdir, 'audio.json')) ? JSON.parse(readFileSync(join(tdir, 'audio.json'), 'utf8')) : null
    if (!manifest) fail(book, `audio is set but ${tdir}/audio.json is missing (run scripts/audio/sync.mjs)`)
    else {
      if (manifest.durations?.length !== count) fail(book, `audio.json has ${manifest.durations?.length} durations, book has ${count} chapters`)
      manifest.durations?.forEach((d, i) => {
        if (d !== null && !existsSync(join(tdir, 'sync', `${String(i + 1).padStart(3, '0')}.json`))) fail(book, `audio.json says chapter ${i + 1} is synced but sync/${String(i + 1).padStart(3, '0')}.json is missing`)
      })
      if (manifest.synced < count) console.warn(`! [${book}] narration lined up for ${manifest.synced} of ${count} chapters`)
    }
  }
  if (meta.id !== book) fail(book, `book.json id is "${meta.id}"`)
  if (meta.source && !['text', 'knowledge'].includes(meta.source)) fail(book, `book.json has bad source "${meta.source}"`)

  if (chapters.length !== count) fail(book, `expected ${count} chapters, found ${chapters.length}`)
  chapters.forEach((c, i) => {
    if (c.number !== i + 1) fail(book, `chapter at index ${i} is numbered ${c.number}`)
    if (typeof c.title !== 'string' || !c.summary || !c.details?.length) fail(book, `chapter ${c.number} is missing title/summary/details`)
  })

  const byId = new Map()
  for (const c of characters) {
    if (byId.has(c.id)) fail(book, `duplicate character id ${c.id}`)
    byId.set(c.id, c)
  }

  for (const c of characters) {
    const where = `character ${c.id}`
    if (c.kind !== undefined && !['character', 'object', 'place'].includes(c.kind)) fail(book, `${where} has bad kind ${c.kind}`)
    if (!c.name || !c.group || !['major', 'supporting', 'minor'].includes(c.importance))
      fail(book, `${where} is missing name/group/importance`)
    if (!(c.firstChapter >= 1 && c.firstChapter <= count)) fail(book, `${where} has bad firstChapter`)
    if (!c.tagline?.some((t) => t.from === c.firstChapter))
      fail(book, `${where} needs a tagline available at its first chapter (${c.firstChapter})`)
    for (const [field, items, key] of [
      ['tagline', c.tagline ?? [], 'from'],
      ['description', c.description ?? [], 'from'],
      ['aliases', c.aliases ?? [], 'from'],
      ['moments', c.moments ?? [], 'chapter'],
    ]) {
      for (const item of items)
        if (!(item[key] >= c.firstChapter && item[key] <= count))
          fail(book, `${where}: ${field} entry at ch ${item[key]} is outside ${c.firstChapter}–${count}`)
    }
    if (c.mergedInto) {
      const target = byId.get(c.mergedInto.id)
      if (!target) fail(book, `${where} merges into unknown ${c.mergedInto.id}`)
      else if (c.mergedInto.from < c.firstChapter) fail(book, `${where} merges before it first appears`)
    }
  }

  for (const ch of chapters) {
    for (const id of ch.characters) {
      const c = byId.get(id)
      if (!c) fail(book, `chapter ${ch.number} lists unknown character ${id}`)
      else if (c.firstChapter > ch.number)
        fail(book, `chapter ${ch.number} lists ${id}, whose firstChapter is ${c.firstChapter}`)
    }
  }
  const relationships = exists('relationships.json') ? load('relationships.json') : []
  const types = ['family', 'love', 'friend', 'enemy', 'work', 'tie']
  const isThing = (c) => c.kind === 'object' || c.kind === 'place'
  const pairs = new Set()
  for (const r of relationships) {
    const where = `relationship ${r.a}–${r.b}`
    const a = byId.get(r.a), b = byId.get(r.b)
    if (!a || !b) { fail(book, `${where} references an unknown character`); continue }
    if (r.a === r.b) fail(book, `${where} links a character to itself`)
    const key = [r.a, r.b].sort().join('|')
    if (pairs.has(key)) fail(book, `${where} is listed twice`)
    pairs.add(key)
    if (!r.states?.length) fail(book, `${where} has no states`)
    let prev = 0
    for (const s of r.states ?? []) {
      if (!types.includes(s.type) || !s.label) fail(book, `${where} has a bad state at ch ${s.from}`)
      if (s.kin && !['parent', 'child', 'sibling', 'spouse', 'grandparent', 'grandchild', 'relative'].includes(s.kin))
        fail(book, `${where} has bad kin ${s.kin} at ch ${s.from}`)
      if ((s.type === 'tie') !== (isThing(a) || isThing(b)))
        fail(book, `${where}: links involving an object or place, and only those, use type "tie"`)
      if (s.from < Math.max(a.firstChapter, b.firstChapter))
        fail(book, `${where} state at ch ${s.from} precedes a character's first appearance`)
      if (s.from > count) fail(book, `${where} state at ch ${s.from} is past the last chapter`)
      if (s.from < prev) fail(book, `${where} states are out of order`)
      prev = s.from
    }
  }

  // Reading guide
  const optional = (f) => (exists(f) ? load(f) : [])
  const kinds = ['word', 'title', 'money', 'history', 'reference', 'foreign', 'custom', 'place', 'lore']
  const notes = optional('notes.json')
  const noteIds = new Set()
  for (const n of notes) {
    if (noteIds.has(n.id)) fail(book, `duplicate note ${n.id}`)
    noteIds.add(n.id)
    if (!n.term || !n.text || !kinds.includes(n.kind)) fail(book, `note ${n.id} is missing term/text or has a bad kind`)
    if (!(n.chapter >= 1 && n.chapter <= count)) fail(book, `note ${n.id} has bad chapter ${n.chapter}`)
    for (const c of n.seeAlso ?? []) if (!(c > n.chapter && c <= count)) fail(book, `note ${n.id} seeAlso ${c} is out of range`)
  }
  const primers = optional('primers.json')
  for (const p of primers) {
    if (!(p.chapter >= 1 && p.chapter <= count) || typeof p.keepInMind !== 'string') fail(book, `primer for ch ${p.chapter} is malformed`)
    for (const r of p.returning ?? []) {
      const c = byId.get(r.id)
      if (!c) fail(book, `primer ch ${p.chapter} lists unknown character ${r.id}`)
      // A returning character must already be known before the chapter is read.
      else if (c.firstChapter >= p.chapter) fail(book, `primer ch ${p.chapter}: ${r.id} hasn't appeared before ch ${p.chapter}`)
    }
  }
  if (new Set(primers.map((p) => p.chapter)).size !== primers.length) fail(book, 'duplicate primers')
  const recaps = optional('recaps.json')
  recaps.forEach((r, i) => {
    if (!(r.through >= 1 && r.through <= count) || !r.title || !r.text?.length) fail(book, `recap ${i} is malformed`)
    if (i && r.through <= recaps[i - 1].through) fail(book, 'recaps must be in chapter order')
  })
  const words = optional('word-counts.json')
  if (words.length && words.length !== count) fail(book, `word-counts has ${words.length} entries, expected ${count}`)

  // Atlas: places, settings and journeys, gated like everything else.
  if (exists('atlas.json')) {
    const atlas = load('atlas.json')
    const frames = new Map(atlas.frames.map((f) => [f.id, f]))
    const places = new Map()
    for (const f of atlas.frames) {
      if (!['geo', 'plan'].includes(f.type) || !f.title || !f.short) fail(book, `frame ${f.id} is malformed`)
      if (f.type === 'geo' && !existsSync(join(root, book, 'atlas', `${f.id}.json`))) fail(book, `frame ${f.id} has no basemap (run scripts/atlas/build-basemaps.mjs)`)
      if (f.type === 'plan' && !existsSync(join(root, book, 'atlas', `${f.id}.json`))) fail(book, `frame ${f.id} has no drawing`)
      if (f.parent && !frames.has(f.parent)) fail(book, `frame ${f.id} has unknown parent ${f.parent}`)
    }
    for (const p of atlas.places) {
      const where = `place ${p.id}`
      if (places.has(p.id)) fail(book, `duplicate place id ${p.id}`)
      places.set(p.id, p)
      if (!p.name || !['setting', 'mentioned'].includes(p.role)) fail(book, `${where} is missing name/role`)
      if (!['exact', 'approximate', 'fictional', 'unknown'].includes(p.precision)) fail(book, `${where} has bad precision`)
      if (!(p.firstChapter >= 1 && p.firstChapter <= count)) fail(book, `${where} has bad firstChapter`)
      if (!p.tagline?.length || p.tagline[0].from > p.firstChapter) fail(book, `${where} needs a tagline at its first chapter (${p.firstChapter})`)
      for (const x of [...(p.tagline ?? []), ...(p.aliases ?? [])]) if (x.from < p.firstChapter) fail(book, `${where} reveals something (from ${x.from}) before it appears (${p.firstChapter})`)
      if (p.lonlat && !(Math.abs(p.lonlat[0]) <= 180 && Math.abs(p.lonlat[1]) <= 90)) fail(book, `${where} has bad lonlat`)
      for (const [fid, xy] of Object.entries(p.xy ?? {})) {
        const f = frames.get(fid)
        if (!f || f.type !== 'plan') fail(book, `${where} is placed in unknown plan frame ${fid}`)
        else if (!(xy[0] >= 0 && xy[1] >= 0 && xy[0] <= f.size[0] && xy[1] <= f.size[1])) fail(book, `${where} is outside frame ${fid}`)
      }
      if (p.precision !== 'unknown' && !p.lonlat && !p.xy) fail(book, `${where} has no position but isn't marked unknown`)
    }
    for (const p of atlas.places) if (p.parent && !places.has(p.parent)) fail(book, `place ${p.id} has unknown parent ${p.parent}`)
    for (const p of atlas.places) {
      if (!p.mergedInto) continue
      const seen = new Set([p.id])
      let cur = p
      while (cur?.mergedInto) {
        const next = places.get(cur.mergedInto.id)
        if (!next) {
          fail(book, `place ${cur.id} merges into unknown place ${cur.mergedInto.id}`)
          break
        }
        if (seen.has(next.id)) {
          fail(book, `place ${p.id} has a merge cycle`)
          break
        }
        if (next.firstChapter > cur.mergedInto.from) fail(book, `place ${cur.id} merges into ${next.id} (ch ${cur.mergedInto.from}) before it appears (ch ${next.firstChapter})`)
        seen.add(next.id)
        cur = next
      }
    }
    for (const f of atlas.frames) {
      if (f.offmap && !frames.has(f.offmap.frame)) fail(book, `frame ${f.id} is off the edge of unknown frame ${f.offmap.frame}`)
      if (f.place && !places.has(f.place)) fail(book, `frame ${f.id} is a close-up of unknown place ${f.place}`)
      if (f.parent && f.type === 'plan' && !f.anchor) fail(book, `plan frame ${f.id} needs an anchor in ${f.parent}`)
    }
    for (const [ch, ids] of Object.entries(atlas.settings)) {
      if (!(Number(ch) >= 1 && Number(ch) <= count)) fail(book, `settings for bad chapter ${ch}`)
      for (const id of ids) {
        const p = places.get(id)
        if (!p) fail(book, `chapter ${ch} is set at unknown place ${id}`)
        else if (p.firstChapter > Number(ch)) fail(book, `chapter ${ch} is set at ${id}, which doesn't appear until ch ${p.firstChapter}`)
      }
    }
    for (let n = 1; n <= count; n++) if (!atlas.settings[String(n)]?.length) console.warn(`! [${book}] chapter ${n} has no setting`)
    for (const j of atlas.journeys) {
      if (!j.name || !j.legs?.length) fail(book, `journey ${j.id} is malformed`)
      for (const id of j.who) if (!byId.has(id)) fail(book, `journey ${j.id} has unknown traveller ${id}`)
      for (const l of j.legs) {
        if (!(l.chapter >= 1 && l.chapter <= count)) fail(book, `journey ${j.id} has a leg in bad chapter ${l.chapter}`)
        for (const id of [l.from, l.to]) {
          const p = places.get(id)
          if (!p) fail(book, `journey ${j.id} uses unknown place ${id}`)
          else if (p.firstChapter > l.chapter) fail(book, `journey ${j.id} reaches ${id} in ch ${l.chapter}, before it appears (ch ${p.firstChapter})`)
        }
      }
    }
    console.log(`✓ [${book}] atlas: ${atlas.frames.length} frames, ${atlas.places.length} places, ${atlas.journeys.length} journeys`)
  }

  // Understanding: themes, insights, afterword, timeline.
  if (exists('understanding.json')) {
    const u = load('understanding.json')
    const themes = new Map((u.themes ?? []).map((th) => [th.id, th]))
    for (const th of u.themes ?? []) {
      if (!th.name || !(th.from >= 1 && th.from <= count)) fail(book, `theme ${th.id} is malformed`)
      if (!th.summary?.length) fail(book, `theme ${th.id} has no summary`)
      else if (th.summary[0].from !== th.from) fail(book, `theme ${th.id}'s first summary must be at its from (${th.from})`)
      for (const [i, s] of (th.summary ?? []).entries()) {
        if (!s.text || !(s.from >= th.from && s.from <= count)) fail(book, `theme ${th.id} summary ${i} is malformed`)
        if (i && s.from <= th.summary[i - 1].from) fail(book, `theme ${th.id} summaries must be in chapter order`)
      }
    }
    const kinds = ['theme', 'motif', 'craft', 'context', 'question']
    const perChapter = new Map()
    for (const ins of u.insights ?? []) {
      const where = `insight ${ins.id}`
      if (!(ins.chapter >= 1 && ins.chapter <= count) || !kinds.includes(ins.kind) || !ins.title || !ins.text) fail(book, `${where} is malformed`)
      for (const id of ins.themes) {
        const th = themes.get(id)
        if (!th) fail(book, `${where} uses unknown theme ${id}`)
        else if (th.from > ins.chapter) fail(book, `${where} tags theme ${id} before it begins (ch ${th.from})`)
      }
      if (/\b(later in the (book|novel)|will (later|eventually)|foreshadow(s|ing)? (his|her|their|the) (death|fate|downfall))\b/i.test(ins.text)) fail(book, `${where} looks ahead ("${ins.text.slice(0, 60)}…")`)
      perChapter.set(ins.chapter, (perChapter.get(ins.chapter) ?? 0) + 1)
    }
    if (u.insights?.length) for (let n = 1; n <= count; n++) if (!perChapter.get(n)) console.warn(`! [${book}] chapter ${n} has no insights`)
    if (u.afterword) {
      const a = u.afterword
      for (const k of ['ending', 'themes', 'interpretations', 'context', 'adaptations', 'readNext', 'questions']) if (!Array.isArray(a[k])) fail(book, `afterword.${k} is missing`)
      for (const r of a.themes ?? []) if (!themes.has(r.theme)) fail(book, `afterword resolves unknown theme ${r.theme}`)
      for (const id of themes.keys()) if (!(a.themes ?? []).some((r) => r.theme === id)) fail(book, `afterword has no resolution for theme ${id}`)
    }
    const placeIds = exists('atlas.json') ? new Set(load('atlas.json').places.map((p) => p.id)) : new Set()
    for (const e of u.timeline ?? []) {
      const where = `timeline ${e.id}`
      if (!/^\d{4}(-\d{2}(-\d{2})?)?$/.test(e.date) || !e.label || !e.title) fail(book, `${where} is malformed`)
      if (!(e.revealed >= 1 && e.revealed <= count)) fail(book, `${where} has bad revealed`)
      if (!e.text?.length || e.text[0].from < e.revealed) fail(book, `${where} text must start at its revealed chapter`)
      for (let i = 1; i < (e.text ?? []).length; i++) if (e.text[i].from <= e.text[i - 1].from) fail(book, `${where} text entries must be in chapter order`)
      for (const c of e.chapters ?? []) if (!(c >= 1 && c <= count)) fail(book, `${where} has bad chapter ${c}`)
      for (const id of e.people ?? []) if (!byId.has(id)) fail(book, `${where} has unknown person ${id}`)
      for (const id of e.places ?? []) if (!placeIds.has(id)) fail(book, `${where} has unknown place ${id}`)
    }
    console.log(`✓ [${book}] understanding: ${themes.size} themes, ${u.insights?.length ?? 0} insights, ${u.afterword ? 'afterword' : 'no afterword'}, ${u.timeline?.length ?? 0} timeline events`)
  }

  // Reveals (read from data-src, never shipped): nothing shown before a reveal's chapter may contain its giveaway terms.
  const revealsFile = join('data-src', book, 'reveals.json')
  data.reveals = existsSync(revealsFile) ? JSON.parse(readFileSync(revealsFile, 'utf8')) : []
  if (!data.reveals.length) console.warn(`! [${book}] no reveals.json — secrets aren't being checked`)
  if (data.reveals.length) {
    const texts = [] // [shownAt, text, where]
    const add = (at, text, where) => text && texts.push([at, String(text), where])
    for (const c of chapters) {
      add(c.number, c.title, `chapter ${c.number} title`)
      add(c.number, c.summary, `chapter ${c.number} summary`)
      for (const d of c.details) add(c.number, d, `chapter ${c.number} details`)
    }
    for (const c of characters) {
      add(c.firstChapter, c.name, `character ${c.id} name`)
      add(c.firstChapter, c.group, `character ${c.id} group`)
      for (const a of c.aliases ?? []) add(a.from, a.name + ' ' + (a.note ?? ''), `character ${c.id} alias`)
      for (const x of c.tagline ?? []) add(x.from, x.text, `character ${c.id} tagline`)
      for (const x of c.description ?? []) add(x.from, x.text, `character ${c.id} description`)
      for (const x of c.moments ?? []) add(x.chapter, x.text, `character ${c.id} moment`)
    }
    for (const r of data.relationships ?? []) for (const s of r.states) add(s.from, s.label, `relationship ${r.a}–${r.b}`)
    for (const n of data.notes ?? []) add(n.chapter, `${n.term} ${n.text} ${n.quote ?? ''}`, `note ${n.id}`)
    for (const p of data.primers ?? []) {
      add(p.chapter - 1, `${p.setting} ${p.keepInMind}`, `primer ${p.chapter}`)
      for (const r of p.returning) add(p.chapter - 1, r.reminder, `primer ${p.chapter} returning ${r.id}`)
    }
    for (const r of data.recaps ?? []) add(r.through, r.text.join(' ') + ' ' + r.title, `recap through ${r.through}`)
    for (const p of data.atlas?.places ?? []) {
      add(p.firstChapter, p.name, `place ${p.id} name`)
      for (const x of p.tagline ?? []) add(x.from, x.text, `place ${p.id} tagline`)
      for (const a of p.aliases ?? []) add(a.from, a.name, `place ${p.id} alias`)
    }
    for (const j of data.atlas?.journeys ?? []) add(Math.min(...j.legs.map((l) => l.chapter)), j.name, `journey ${j.id}`)
    for (const th of data.themes ?? []) {
      add(th.from, th.name, `theme ${th.id}`)
      for (const s of th.summary ?? []) add(s.from, s.text, `theme ${th.id} summary`)
    }
    for (const i of data.insights ?? []) add(i.chapter, `${i.title} ${i.text}`, `insight ${i.id}`)
    for (const e of data.timeline ?? []) {
      add(e.revealed, `${e.title} ${e.label}`, `timeline ${e.id}`)
      for (const x of e.text) add(x.from, x.text, `timeline ${e.id} text`)
    }
    for (const r of data.reveals) {
      if (!r.id || !r.secret || !(r.chapter >= 1 && r.chapter <= count)) fail(book, `reveal ${r.id} is malformed`)
      for (const term of r.terms ?? []) {
        const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i')
        for (const [at, text, where] of texts) if (at < r.chapter && re.test(text)) fail(book, `${where} (shown at ch ${at}) mentions "${term}", revealed in ch ${r.chapter}`)
      }
    }
  }

  for (const c of characters) {
    if (!chapters.some((ch) => ch.characters.includes(c.id)))
      console.warn(`! [${book}] character ${c.id} is not listed in any chapter`)
  }

  console.log(`✓ [${book}] ${chapters.length} chapters, ${characters.length} characters, ${relationships.length} relationships, ${notes.length} notes, ${primers.length} primers, ${recaps.length} recaps checked`)
}

if (errors) {
  console.error(`${errors} data error(s)`)
  process.exit(1)
}
