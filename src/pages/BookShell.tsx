import { useEffect, useRef, useState } from 'react'
import type { BookData } from '../types'
import { loadBook } from '../books'
import { useBookmark } from '../lib/progress'
import { href } from '../lib/router'
import { newInChapter } from '../lib/spoilers'
import SiteHeader from '../components/SiteHeader'
import BookmarkBar from '../components/BookmarkBar'
import NotFound from './NotFound'
import Overview from './Overview'
import ChapterList from './ChapterList'
import ChapterDetail from './ChapterDetail'
import CharacterList from './CharacterList'
import CharacterProfile from './CharacterProfile'
import MapPage from './MapPage'

export interface BookPageProps {
  book: BookData
  upTo: number
  setUpTo: (n: number) => void
}

export default function BookShell({ bookId, rest }: { bookId: string; rest: string[] }) {
  const [book, setBook] = useState<BookData | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const p = loadBook(bookId)
    if (!p) {
      setFailed(true)
      return
    }
    let live = true
    p.then((b) => live && setBook(b)).catch(() => live && setFailed(true))
    return () => {
      live = false
    }
  }, [bookId])

  if (failed) return <NotFound message="We couldn’t find that book." />
  if (!book)
    return (
      <>
        <SiteHeader />
        <main className="wrap page">
          <p className="muted">Opening the book…</p>
        </main>
      </>
    )
  return <LoadedBook book={book} rest={rest} />
}

function LoadedBook({ book, rest }: { book: BookData; rest: string[] }) {
  const [upTo, setUpTo] = useBookmark(book.meta.id, book.meta.chapterCount)
  const toast = useUnlockToast(book, upTo)
  const props: BookPageProps = { book, upTo, setUpTo }
  const [section, param] = rest

  let page
  if (!section) page = <Overview {...props} />
  else if (section === 'chapters' && !param) page = <ChapterList {...props} />
  else if (section === 'chapters') page = <ChapterDetail {...props} n={Number(param)} />
  else if (section === 'characters' && !param) page = <CharacterList {...props} />
  else if (section === 'characters') page = <CharacterProfile {...props} id={param} />
  else if (section === 'map') page = <MapPage {...props} focusId={param} />
  else return <NotFound />

  const tab = (name: string, label: string) => (
    <a
      className={'tab' + ((section ?? '') === name ? ' tab--active' : '')}
      href={name ? href('b', book.meta.id, name) : href('b', book.meta.id)}
      aria-current={(section ?? '') === name ? 'page' : undefined}
    >
      {label}
    </a>
  )

  return (
    <>
      <SiteHeader>
        <span className="site-header__book">{book.meta.title}</span>
      </SiteHeader>
      <div className="book-bar">
        <div className="wrap">
          <BookmarkBar book={book} upTo={upTo} setUpTo={setUpTo} />
          <nav className="tabs" aria-label="Book sections">
            {tab('', 'Overview')}
            {tab('chapters', 'Chapters')}
            {tab('characters', 'Characters')}
            {tab('map', 'Map')}
          </nav>
        </div>
      </div>
      <main className="wrap page">{page}</main>
      {toast && (
        <div className="toast" role="status" key={toast.key}>
          {toast.text}
        </div>
      )}
    </>
  )
}

/** Briefly announce what moving the bookmark forward unlocked. */
function useUnlockToast(book: BookData, upTo: number) {
  const prev = useRef(upTo)
  const [toast, setToast] = useState<{ key: number; text: string } | null>(null)

  useEffect(() => {
    const before = prev.current
    prev.current = upTo
    if (upTo <= before) return
    let fresh = 0
    for (let n = before + 1; n <= upTo; n++) fresh += newInChapter(book, n, upTo).length
    const span = upTo - before === 1 ? `Chapter ${upTo} unlocked` : `Chapters ${before + 1}–${upTo} unlocked`
    const people = fresh ? ` · ${fresh} new character${fresh === 1 ? '' : 's'}` : ''
    setToast({ key: Date.now(), text: span + people })
    const t = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(t)
  }, [book, upTo])

  return toast
}
