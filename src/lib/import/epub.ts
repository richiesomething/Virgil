// EPUB → paragraphs, in spine order. Unzips with fflate and reads the XHTML with the browser's parser.
import { unzipSync, strFromU8 } from 'fflate'
import type { Para } from './chapters'

const BLOCKS = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'DIV', 'BLOCKQUOTE', 'SECTION', 'ARTICLE', 'TD', 'DD', 'DT', 'FIGCAPTION', 'PRE'])
const SKIP = new Set(['SCRIPT', 'STYLE', 'NAV', 'HEADER', 'FOOTER', 'ASIDE', 'SUP', 'TABLE', 'SVG', 'IMG', 'FIGURE'])

export async function parseEpub(data: ArrayBuffer): Promise<Para[]> {
  const files = unzipSync(new Uint8Array(data))
  const text = (path: string) => {
    const f = files[path] ?? files[decodeURIComponent(path)]
    if (!f) throw new Error(`Missing ${path} in the EPUB`)
    return strFromU8(f)
  }
  const dom = new DOMParser()
  const container = dom.parseFromString(text('META-INF/container.xml'), 'application/xml')
  const opfPath = container.querySelector('rootfile')?.getAttribute('full-path')
  if (!opfPath) throw new Error('Not an EPUB (no package file)')
  const base = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : ''
  const opf = dom.parseFromString(text(opfPath), 'application/xml')
  const items = new Map<string, { href: string; props: string }>()
  opf.querySelectorAll('manifest > item').forEach((it) => items.set(it.getAttribute('id') ?? '', { href: it.getAttribute('href') ?? '', props: it.getAttribute('properties') ?? '' }))
  const spine = [...opf.querySelectorAll('spine > itemref')].map((r) => items.get(r.getAttribute('idref') ?? '')).filter((x): x is { href: string; props: string } => !!x)
  if (!spine.length) throw new Error('The EPUB has no reading order')

  const out: Para[] = []
  for (const item of spine) {
    if (item.props.includes('nav')) continue
    const path = resolve(base, item.href.split('#')[0])
    let html: string
    try {
      html = text(path)
    } catch {
      continue
    }
    let doc = dom.parseFromString(html, 'application/xhtml+xml')
    if (doc.querySelector('parsererror')) doc = dom.parseFromString(html, 'text/html')
    const body = doc.body ?? doc.documentElement
    if (!body) continue
    if (/\b(toc|landmarks|copyright-page|titlepage|cover)\b/.test(body.querySelector('[epub\\:type], [role]')?.getAttribute('epub:type') ?? '')) continue
    walk(body, out)
  }
  return out
}

function resolve(base: string, href: string): string {
  const parts = (base + href).split('/')
  const stack: string[] = []
  for (const p of parts) {
    if (p === '..') stack.pop()
    else if (p !== '.' && p !== '') stack.push(p)
  }
  return stack.join('/')
}

/** Depth-first: the innermost block elements become paragraphs. */
function walk(el: Element, out: Para[]) {
  for (const child of el.children) {
    const tag = child.tagName.toUpperCase()
    if (SKIP.has(tag)) continue
    const hasBlockChild = [...child.children].some((c) => BLOCKS.has(c.tagName.toUpperCase()))
    if (BLOCKS.has(tag) && !hasBlockChild) {
      const t = (child.textContent ?? '').replace(/\s+/g, ' ').trim()
      if (t) out.push({ text: t, heading: /^H[1-6]$/.test(tag) || undefined })
    } else if (tag === 'BR' || tag === 'HR') {
      continue
    } else {
      walk(child, out)
    }
  }
}
