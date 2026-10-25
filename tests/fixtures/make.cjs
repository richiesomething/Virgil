// Builds test copies of a book from its shipped public-domain text: an EPUB, a PDF (with running
// heads and page numbers, like a real one) and a text file. Usage: node tests/fixtures/make.cjs
const fs = require('fs')
const path = require('path')
const { zipSync, strToU8 } = require('fflate')

const BOOK = 'twenty-thousand-leagues'
const CHAPTERS = 6
const out = __dirname
const titles = ['A Runaway Reef', 'The Pros and Cons', 'As Master Wishes', 'Ned Land', 'At Random!', 'At Full Steam']
const chapters = Array.from({ length: CHAPTERS }, (_, i) => fs.readFileSync(path.join(__dirname, '../../public/texts', BOOK, `${String(i + 1).padStart(3, '0')}.txt`), 'utf8').split(/\n\n+/).filter(Boolean))

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
const xhtml = (i) => `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Chapter ${i + 1}</title></head><body>
<section><h2>Chapter ${i + 1}</h2><h3>${esc(titles[i])}</h3>
${chapters[i].map((p) => `<p>${esc(p)}</p>`).join('\n')}
</section></body></html>`

// EPUB: the minimum a real one has (container, OPF, nav, chapters).
const files = {
  mimetype: strToU8('application/epub+zip'),
  'META-INF/container.xml': strToU8(`<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`),
  'OEBPS/content.opf': strToU8(`<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">test</dc:identifier><dc:title>Twenty Thousand Leagues (test)</dc:title></metadata>
<manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>${chapters.map((_, i) => `<item id="c${i}" href="c${i}.xhtml" media-type="application/xhtml+xml"/>`).join('')}</manifest>
<spine><itemref idref="title"/><itemref idref="nav"/>${chapters.map((_, i) => `<itemref idref="c${i}"/>`).join('')}</spine></package>`),
  'OEBPS/nav.xhtml': strToU8(`<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><body><nav epub:type="toc"><ol>${chapters.map((_, i) => `<li><a href="c${i}.xhtml">Chapter ${i + 1}</a></li>`).join('')}</ol></nav></body></html>`),
  'OEBPS/title.xhtml': strToU8(`<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><body><h1>Twenty Thousand Leagues Under the Seas</h1><p>Jules Verne</p><p>Translated by F. P. Walter</p></body></html>`),
}
chapters.forEach((_, i) => (files[`OEBPS/c${i}.xhtml`] = strToU8(xhtml(i))))
fs.writeFileSync(path.join(out, 'leagues.epub'), zipSync(files, { level: 6 }))

// Text file, with the headings a plain-text edition would have.
fs.writeFileSync(path.join(out, 'leagues.txt'), chapters.map((ps, i) => `CHAPTER ${i + 1}\n\n${titles[i]}\n\n${ps.join('\n\n')}`).join('\n\n\n'))

// PDF: printed from HTML with Chromium, with a running head and page numbers.
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
body{font:11pt/1.45 Georgia,serif;margin:0} h2{font-size:18pt;margin:60pt 0 6pt;text-align:center} h3{font-size:14pt;text-align:center;margin:0 0 24pt;font-weight:normal}
p{margin:0;text-indent:1.5em;text-align:justify} p.first{text-indent:0}
</style></head><body>${chapters.map((ps, i) => `<h2>Chapter ${i + 1}</h2><h3>${esc(titles[i])}</h3>${ps.map((p, j) => `<p${j === 0 ? ' class="first"' : ''}>${esc(p)}</p>`).join('')}`).join('')}</body></html>`
fs.writeFileSync(path.join(out, 'leagues.html'), html)
;(async () => {
  const { chromium } = require('playwright')
  const b = await chromium.launch()
  const p = await b.newPage()
  await p.setContent(html)
  await p.pdf({
    path: path.join(out, 'leagues.pdf'),
    format: 'A5',
    margin: { top: '60px', bottom: '60px', left: '48px', right: '48px' },
    displayHeaderFooter: true,
    headerTemplate: '<div style="font:8pt Georgia;width:100%;text-align:center;color:#444">TWENTY THOUSAND LEAGUES UNDER THE SEAS</div>',
    footerTemplate: '<div style="font:8pt Georgia;width:100%;text-align:center;color:#444"><span class="pageNumber"></span></div>',
  })
  await b.close()
  fs.unlinkSync(path.join(out, 'leagues.html'))
  console.log('wrote leagues.epub, leagues.pdf, leagues.txt in tests/fixtures/')
})()
