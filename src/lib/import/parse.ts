// Reads an EPUB, PDF or text file into paragraphs. Parsers load on demand so the app bundle stays small.
import type { Para } from './chapters'
import { splitParagraphs } from '../text'

export type Progress = (message: string, fraction?: number) => void

export async function parseFile(file: File, progress: Progress = () => {}): Promise<Para[]> {
  const name = file.name.toLowerCase()
  if (file.size > 200 * 1024 * 1024) throw new Error('That file is over 200 MB.')
  if (name.endsWith('.epub') || file.type === 'application/epub+zip') {
    progress('Unpacking the EPUB…')
    const { parseEpub } = await import('./epub')
    return parseEpub(await file.arrayBuffer())
  }
  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    progress('Reading the PDF…')
    const { parsePdf } = await import('./pdf')
    return parsePdf(await file.arrayBuffer(), (done, total) => progress(`Reading page ${done} of ${total}…`, done / total))
  }
  if (name.endsWith('.txt') || name.endsWith('.md') || file.type.startsWith('text/')) {
    progress('Reading the text…')
    return splitParagraphs(await file.text()).map((text) => ({ text }))
  }
  throw new Error('Virgil can read EPUB, PDF and plain-text files.')
}
