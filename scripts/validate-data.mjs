// Checks book data for structural mistakes and spoiler leaks. Run by `npm run build`.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = 'src/books'
let errors = 0
const fail = (book, msg) => {
  errors++
  console.error(`✗ [${book}] ${msg}`)
}

for (const book of readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)) {
  const load = (f) => JSON.parse(readFileSync(join(root, book, f), 'utf8'))
  const chapters = load('chapters.json')
  const characters = load('characters.json')
  const meta = readFileSync(join(root, book, 'meta.ts'), 'utf8')
  const count = Number(meta.match(/chapterCount:\s*(\d+)/)?.[1])

  if (chapters.length !== count) fail(book, `expected ${count} chapters, found ${chapters.length}`)
  chapters.forEach((c, i) => {
    if (c.number !== i + 1) fail(book, `chapter at index ${i} is numbered ${c.number}`)
    if (!c.title || !c.summary || !c.details?.length) fail(book, `chapter ${c.number} is missing title/summary/details`)
  })

  const byId = new Map()
  for (const c of characters) {
    if (byId.has(c.id)) fail(book, `duplicate character id ${c.id}`)
    byId.set(c.id, c)
  }

  for (const c of characters) {
    const where = `character ${c.id}`
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
  for (const c of characters) {
    if (!chapters.some((ch) => ch.characters.includes(c.id)))
      console.warn(`! [${book}] character ${c.id} is not listed in any chapter`)
  }

  console.log(`✓ [${book}] ${chapters.length} chapters, ${characters.length} characters checked`)
}

if (errors) {
  console.error(`${errors} data error(s)`)
  process.exit(1)
}
