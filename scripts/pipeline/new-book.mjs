// Scaffolds a new book: data-src/<id>/ with book.json, reveals.json and pipeline.json.
// With --gutenberg <n>, also downloads the public-domain text to data-src/<id>/source/book.txt.
// Usage: npm run new-book -- <id> "<Title>" "<Author>" [--year 1870] [--gutenberg 2488] [--knowledge]
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { STAGES } from './stages.mjs'

const args = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? (args[i + 1]?.startsWith('--') || args[i + 1] === undefined ? true : args.splice(i, 2)[1]) : undefined
}
const year = flag('year')
const gutenberg = flag('gutenberg')
const knowledge = args.includes('--knowledge')
const [id, title, author] = args.filter((a) => !a.startsWith('--'))
if (!id || !title || !author || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) {
  console.error('Usage: npm run new-book -- <kebab-id> "<Title>" "<Author>" [--year 1870] [--gutenberg 2488] [--knowledge]')
  process.exit(1)
}
const dir = join('data-src', id)
if (existsSync(join(dir, 'book.json'))) {
  console.error(`${dir}/book.json already exists`)
  process.exit(1)
}
mkdirSync(join(dir, 'atlas'), { recursive: true })

const order = Math.max(0, ...readdirSync('data-src').filter((d) => existsSync(join('data-src', d, 'book.json'))).map((d) => JSON.parse(readFileSync(join('data-src', d, 'book.json'), 'utf8')).order ?? 0)) + 1
const book = {
  id,
  title,
  author,
  year: year ? Number(year) : 0,
  chapterCount: 0,
  blurb: '',
  edition: gutenberg ? `Project Gutenberg #${gutenberg}` : '',
  ...(gutenberg ? { sourceUrl: `https://www.gutenberg.org/ebooks/${gutenberg}` } : {}),
  volumes: [],
  color: '#3d4f5c',
  order,
  source: knowledge || !gutenberg ? 'knowledge' : 'text',
  ...(knowledge || !gutenberg ? { wordCountsApproximate: true } : {}),
}
writeFileSync(join(dir, 'book.json'), JSON.stringify(book, null, 2) + '\n')
writeFileSync(join(dir, 'reveals.json'), '[]\n')
writeFileSync(
  join(dir, 'pipeline.json'),
  JSON.stringify({ book: id, stages: Object.fromEntries(STAGES.map((s) => [s.id, { status: 'pending' }])) }, null, 2) + '\n',
)
console.log(`Created ${dir}/ (book.json, reveals.json, pipeline.json)`)

if (gutenberg) {
  mkdirSync(join(dir, 'source'), { recursive: true })
  const urls = [`https://www.gutenberg.org/cache/epub/${gutenberg}/pg${gutenberg}.txt`, `https://www.gutenberg.org/files/${gutenberg}/${gutenberg}-0.txt`]
  let text = null
  for (const url of urls) {
    try {
      const res = await fetch(url)
      if (res.ok) {
        text = await res.text()
        break
      }
    } catch {}
  }
  if (!text) {
    console.warn(`Couldn't download Gutenberg #${gutenberg}; put the text in ${dir}/source/book.txt yourself.`)
  } else {
    // Keep only the book itself, between Gutenberg's START and END markers.
    const start = text.search(/\*\*\* ?START OF (THE|THIS) PROJECT GUTENBERG[^\n]*\n/i)
    const end = text.search(/\*\*\* ?END OF (THE|THIS) PROJECT GUTENBERG/i)
    const body = text.slice(start >= 0 ? text.indexOf('\n', start) + 1 : 0, end >= 0 ? end : undefined).replace(/\r\n/g, '\n')
    writeFileSync(join(dir, 'source', 'book.txt'), body)
    console.log(`Downloaded Gutenberg #${gutenberg} → ${dir}/source/book.txt (${body.split(/\s+/).length.toLocaleString()} words)`)
  }
}
console.log('Next: run /add-book in Claude Code, or see docs/adding-a-book.md.')
