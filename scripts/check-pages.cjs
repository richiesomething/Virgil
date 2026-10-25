// Opens every page of every book (at chapter 1, halfway and the end) and reports crashes or empty pages.
// Needs Playwright and a running preview: npm run build && npx vite preview --port 4182, then node scripts/check-pages.cjs [book]
const { chromium, devices } = require('playwright')
const fs = require('fs')
const base = process.env.BASE_URL || 'http://localhost:4182/'
const only = process.argv[2]
;(async () => {
  const b = await chromium.launch()
  const ctx = await b.newContext({ ...devices['iPhone 13'] })
  const p = await ctx.newPage()
  let errs = []
  p.on('pageerror', (e) => errs.push(e.message))
  await p.goto(base)
  const bad = []
  let n = 0
  for (const id of fs.readdirSync('src/books').filter((d) => fs.existsSync(`src/books/${d}/data.json`) && (!only || d === only))) {
    const d = JSON.parse(fs.readFileSync(`src/books/${id}/data.json`))
    const total = d.chapters.length
    const paths = [...d.characters.map((c) => 'characters/' + c.id), ...(d.atlas?.places ?? []).map((x) => 'places/' + x.id), ...d.chapters.map((c) => 'chapters/' + c.number), ...d.chapters.map((c) => 'chapters/' + c.number + '?tab=insights'), ...(d.themes ?? []).map((t) => 'themes/' + t.id), 'cast', 'cast?seg=places', 'cast?seg=things', 'glossary', 'recap', 'plan', 'map', 'afterword', 'timeline', '']
    for (const up of [1, Math.ceil(total / 2), total]) {
      await p.evaluate(([id, up]) => localStorage.setItem('virgil:progress:v1', JSON.stringify({ [id]: up })), [id, up])
      await p.goto(base + '#/b/' + id); await p.reload()
      await p.waitForFunction(() => !/Opening the book/.test(document.body.innerText))
      for (const path of paths) {
        errs = []
        await p.evaluate((h) => (location.hash = h), `#/b/${id}/${path}`)
        await p.waitForTimeout(30)
        const len = await p.evaluate(() => document.querySelector('#root')?.innerText.trim().length ?? 0)
        n++
        if (errs.length || len < 20) { bad.push(`${id}@${up} ${path} len=${len} ${errs[0] ?? ""}`); await p.reload(); await p.waitForFunction(() => !/Opening the book/.test(document.body.innerText)) }
      }
    }
  }
  console.log('visited', n, 'bad', bad.length); console.log(bad.slice(0, 40).join('\n'))
  await b.close()
})()
