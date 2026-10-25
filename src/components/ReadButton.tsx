import Icon from './Icon'
import { useBook } from '../lib/book-context'
import { href } from '../lib/router'
import { useCopy } from '../lib/copies'
import { reading, resumeFor, textSource } from '../lib/text'

/**
 * Opens the reader for chapter `n`: "Read chapter 3", or "Continue reading · 42%" partway through.
 * For a copyrighted book with no copy on this device, offers to add one instead.
 */
export default function ReadButton({ n, primary = true, again = false }: { n: number; primary?: boolean; again?: boolean }) {
  const { book } = useBook()
  const id = book.meta.id
  const copy = useCopy(id)
  const source = textSource(book.meta, copy.status === 'ready' ? copy.info : null)
  const all = reading.use()
  const cls = `btn ${primary ? 'btn--primary btn--lg' : 'btn--secondary'} btn--block`

  if (source === 'none') {
    if (copy.status === 'loading') return null
    return (
      <a className="btn btn--secondary btn--block" href={href('b', id, 'text')}>
        <Icon name="upload" /> Add your copy to read it here
      </a>
    )
  }
  const pos = resumeFor(all, id, n)
  return (
    <a className={cls} href={href('b', id, 'read', n)}>
      <Icon name={again ? 'bookOpen' : 'play'} />
      {pos ? `Continue reading · ${Math.round((pos.word / pos.words) * 100)}%` : again ? `Read chapter ${n} again` : `Read chapter ${n}`}
    </a>
  )
}
