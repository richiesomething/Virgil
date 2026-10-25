// PDF → paragraphs. pdf.js gives positioned text runs; this groups them into lines and paragraphs,
// drops running headers, footers and page numbers, and joins words hyphenated across lines.
import type { Para } from './chapters'

interface Line {
  text: string
  x: number
  y: number
  size: number
  width: number
}

export async function parsePdf(data: ArrayBuffer, onProgress?: (done: number, total: number) => void): Promise<Para[]> {
  const pdfjs = await import('pdfjs-dist')
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise
  const items: TextItem[][] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    items.push(content.items as TextItem[])
    onProgress?.(i, doc.numPages)
  }
  await doc.cleanup()
  const sizes = items
    .flat()
    .filter((it) => it.str?.trim())
    .map((it) => Math.abs(it.transform[3]) || Math.abs(it.transform[0]) || 10)
    .sort((a, b) => a - b)
  const bodySize = sizes[Math.floor(sizes.length / 2)] ?? 10
  const pages = items.map((its) => linesOf(its, bodySize))
  const total = pages.reduce((n, p) => n + p.length, 0)
  if (total < pages.length * 2) throw new Error('This PDF has no text layer (it may be scanned). Try an EPUB or a text file.')
  return paragraphsOf(stripFurniture(pages, bodySize), bodySize)
}

interface TextItem {
  str: string
  transform: number[]
  width: number
  hasEOL?: boolean
}

/** Group runs on the same baseline into lines, left to right. Superscript footnote markers are dropped. */
function linesOf(items: TextItem[], bodySize: number): Line[] {
  const runs = items
    .filter((it) => it.str !== undefined && it.transform)
    .map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5], size: Math.abs(it.transform[3]) || Math.abs(it.transform[0]) || 10, width: it.width ?? 0 }))
    .filter((r) => !(r.size < bodySize * 0.75 && /^\s*\d{1,3}\s*$/.test(r.str)))
  runs.sort((a, b) => b.y - a.y || a.x - b.x)
  const lines: Line[] = []
  for (const r of runs) {
    const last = lines[lines.length - 1]
    if (last && Math.abs(last.y - r.y) <= Math.max(2, last.size * 0.35)) {
      const gap = r.x - (last.x + last.width)
      const space = gap > last.size * 0.15 && !last.text.endsWith(' ') && !r.str.startsWith(' ') && !/[—‐-]$/.test(last.text) && !/^[—]/.test(r.str) ? ' ' : ''
      last.text += space + r.str
      last.width = Math.max(last.width, r.x + r.width - last.x)
      last.size = Math.max(last.size, r.size)
    } else {
      lines.push({ text: r.str, x: r.x, y: r.y, size: r.size, width: r.width })
    }
  }
  return lines.map((l) => ({ ...l, text: l.text.replace(/\s+/g, ' ').trim() })).filter((l) => l.text)
}

/**
 * Remove page numbers and lines that repeat at the top or bottom of pages (running heads).
 * Heading-sized lines are kept: a chapter number at the top of its first page is not a page number.
 */
function stripFurniture(pages: Line[][], bodySize: number): Line[][] {
  const seen = new Map<string, number>()
  const key = (t: string) => t.replace(/\d+/g, '#').toLowerCase()
  for (const p of pages) for (const l of [...p.slice(0, 2), ...p.slice(-2)]) seen.set(key(l.text), (seen.get(key(l.text)) ?? 0) + 1)
  const threshold = pages.length >= 6 ? 3 : 2
  return pages.map((p) =>
    p.filter((l, i) => {
      const edge = i < 2 || i >= p.length - 2
      if (!edge || l.size > bodySize * 1.15 || /^(chapter|part|book)\b/i.test(l.text)) return true
      if (/^\s*(page\s+)?[\divxlc]+\s*$/i.test(l.text)) return false
      // Footnotes: small type at the foot of the page, starting with a number.
      if (i >= p.length - 3 && l.size < bodySize * 0.9 && /^\d{1,3}[.)]?\s/.test(l.text)) return false
      return (seen.get(key(l.text)) ?? 0) < threshold
    }),
  )
}

/** Lines → paragraphs, using vertical gaps, indents, short lines and font size. */
function paragraphsOf(pages: Line[][], bodySize: number): Para[] {
  const all = pages.flat()
  if (!all.length) return []
  const lefts = all.filter((l) => l.size <= bodySize * 1.1).map((l) => l.x).sort((a, b) => a - b)
  const leftMargin = lefts[Math.floor(lefts.length * 0.1)] ?? 0
  const widths = all.map((l) => l.width).sort((a, b) => a - b)
  const fullWidth = widths[Math.floor(widths.length * 0.9)] ?? 0

  const out: Para[] = []
  let current: { text: string; heading: boolean } | null = null
  const flush = () => {
    if (current && current.text.trim()) out.push({ text: current.text.trim(), heading: current.heading || undefined })
    current = null
  }
  let dropCap = ''
  for (const page of pages) {
    let prev: Line | null = null // null at the top of a page: a paragraph may run on from the last page
    for (let line of page) {
      // A drop cap is a one-letter line in a large size: it belongs to the line after it.
      if (line.text.length <= 2 && line.size > bodySize * 1.3) {
        dropCap = line.text
        continue
      }
      if (dropCap) {
        line = { ...line, text: dropCap + line.text, size: bodySize }
        dropCap = ''
        flush()
        current = { text: line.text, heading: false }
        prev = line
        continue
      }
      const heading = line.size > bodySize * 1.15 || (line.text.length < 60 && /^[A-Z0-9 .,'’:—-]+$/.test(line.text) && /[A-Z]/.test(line.text))
      const gap = prev ? prev.y - line.y : 0
      const bigGap = prev ? gap > prev.size * 1.9 : false
      const indented = line.x > leftMargin + bodySize * 0.8 && !!prev && prev.x <= leftMargin + bodySize * 0.3
      const prevShort = !!prev && prev.width < fullWidth * 0.75 && /[.!?”’"]$/.test(prev.text)
      const newPara = !current || bigGap || indented || prevShort || heading !== current.heading
      if (newPara) {
        flush()
        current = { text: line.text, heading }
      } else if (current) {
        // A word broken across lines: a soft hyphen or hyphen character joins without it.
        if (/[a-z][‐\u00AD-]$/.test(current.text) && /^[a-z]/.test(line.text)) current.text = current.text.slice(0, -1) + line.text
        else if (/—$/.test(current.text) || /^—/.test(line.text)) current.text += line.text
        else current.text += ' ' + line.text
      }
      prev = line
    }
    // A paragraph can run over the page break: keep `current` open unless the page ended with a sentence.
    if (prev && /[.!?”’"]$/.test(prev.text) && prev.width < fullWidth * 0.75) flush()
  }
  flush()
  return out
}
