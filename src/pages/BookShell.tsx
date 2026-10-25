import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { BookData } from '../types'
import { loadBook } from '../books'
import { getProgress, setProgressRaw, useBookmark } from '../lib/progress'
import { href, settleScroll, useLocation } from '../lib/router'
import { isThing, newInChapter } from '../lib/spoilers'
import { planFor, plans, prefs, visits } from '../lib/store'
import { chapterMinutes, planStats } from '../lib/planner'
import { BookContext, type BookContextValue } from '../lib/book-context'
import { BookHeader, TabBar, rememberTab, tabOf } from '../components/BookChrome'
import BookmarkSheet from '../components/BookmarkSheet'
import SearchOverlay from '../components/SearchOverlay'
import { NoteSheet, SettingsSheet } from '../components/Sheets'
import { showToast } from '../components/ui'
import NotFound from './NotFound'
import Today from './Today'
import ChapterList from './ChapterList'
import ChapterDetail from './ChapterDetail'
import Cast, { MapScreen } from './Cast'
import CharacterProfile from './CharacterProfile'
import PlacePage from './PlacePage'
import Themes, { ThemePage } from './Themes'
import Afterword from './Afterword'
import Timeline from './Timeline'
import { placeAt } from '../lib/atlas'
import Glossary from './Glossary'
import Recap from './Recap'
import Planner from './Planner'

/** Kept for pages that still take explicit props. */
export interface BookPageProps {
  book: BookData
  upTo: number
  setUpTo: (n: number) => void
}

export default function BookShell({ bookId }: { bookId: string }) {
  const [book, setBook] = useState<BookData | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const p = loadBook(bookId)
    if (!p) return setFailed(true)
    let live = true
    p.then((b) => live && setBook(b)).catch(() => live && setFailed(true))
    return () => {
      live = false
    }
  }, [bookId])

  if (failed) return <NotFound message="We couldn’t find that book." />
  if (!book) return <div className="wrap screen muted">Opening the book…</div>
  return <LoadedBook book={book} />
}

const WELCOME_DAYS = 4
const dismissedThisSession = new Set<string>()

function LoadedBook({ book }: { book: BookData }) {
  const id = book.meta.id
  const total = book.meta.chapterCount
  const [upTo, setUpTo] = useBookmark(id, total)
  const loc = useLocation()
  const [section, param] = loc.parts.slice(2)
  const tab = tabOf(section)
  const { wpm } = prefs.use()

  const [bookmarkOpen, setBookmarkOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [noteId, setNoteId] = useState<string | null>(null)
  const searchInput = useRef<HTMLInputElement>(null)

  // Welcome back: compare with the last visit, read once before it's overwritten.
  const [welcome, setWelcome] = useState<{ gapDays: number } | null>(() => {
    const last = visits.get()[id]
    if (!last || dismissedThisSession.has(id)) return null
    const gapDays = Math.floor((Date.now() - new Date(last).getTime()) / 86_400_000)
    const progress = getProgress(id)
    return gapDays >= WELCOME_DAYS && progress >= 3 && progress < total ? { gapDays } : null
  })
  useEffect(() => {
    const stamp = () => visits.set((v) => ({ ...v, [id]: new Date().toISOString() }))
    stamp()
    const onHide = () => document.visibilityState === 'hidden' && stamp()
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [id])
  const dismissWelcome = useCallback(() => {
    dismissedThisSession.add(id)
    setWelcome(null)
  }, [id])

  // Remember where each tab was left, and restore scroll on back.
  const samePage = useRef('')
  useEffect(() => {
    rememberTab(id, tab, window.location.hash || href('b', id))
    const pageKey = section === 'map' ? 'map' : section === 'cast' && loc.query.get('view') === 'map' ? 'atlas' : loc.path
    settleScroll(loc.path, pageKey === samePage.current)
    samePage.current = pageKey
  }, [id, tab, section, loc.path, loc.query])

  const setBookmark = useCallback(
    (n: number) => {
      const from = getProgress(id)
      const to = Math.max(0, Math.min(total, n))
      if (to === from) return
      const planBefore = planFor(plans.get(), id)
      setUpTo(to)
      setBookmarkOpen(false)
      const undo = {
        label: 'Undo',
        run: () => {
          setProgressRaw(id, from)
          plans.set((all) => ({ ...all, [id]: planBefore }))
        },
      }
      if (to < from) return showToast(`Bookmark moved back to chapter ${to}.`, undo)
      if (to === total) return showToast(`You’ve finished the book.`, undo)
      let fresh = 0
      for (let c = from + 1; c <= to; c++) fresh += newInChapter(book, c, to).filter((x) => !isThing(x)).length
      const people = fresh ? ` · ${fresh} new character${fresh === 1 ? '' : 's'}` : ''
      if (to - from > 1) return showToast(`Chapters ${from + 1}–${to} unlocked${people}.`, undo)
      const plan = planFor(plans.get(), id)
      const stats = planStats(book, to, plan, wpm)
      const goal = plan.goal?.type === 'minutes' ? plan.goal.minutes : null
      const before = stats.todayMinutes - chapterMinutes(book, to, wpm)
      if (goal && stats.todayMinutes >= goal && before < goal)
        return showToast(`Chapter ${to} done — that’s today’s ${goal} minutes.`, undo)
      showToast(`Chapter ${to} done${people}.`, undo)
    },
    [book, id, total, setUpTo, wpm],
  )

  const openSearch = useCallback(() => {
    // Focus inside the tap so iOS opens the keyboard.
    searchInput.current?.focus({ preventScroll: true })
    setSearchOpen(true)
  }, [])

  const ctx: BookContextValue = useMemo(
    () => ({
      book,
      upTo,
      setBookmark,
      openBookmark: () => setBookmarkOpen(true),
      openSearch,
      openNote: setNoteId,
      openSettings: () => setSettingsOpen(true),
      welcome,
      dismissWelcome,
    }),
    [book, upTo, setBookmark, openSearch, welcome, dismissWelcome],
  )

  // Deep link to a glossary note opens its sheet over the glossary.
  useEffect(() => {
    if (section === 'glossary' && param) setNoteId(param)
  }, [section, param])

  let page
  let title: string | undefined
  let isRoot = true
  if (!section) page = <Today />
  else if (section === 'recap') ((page = <Recap />), (title = 'Story so far'), (isRoot = false))
  else if (section === 'plan') ((page = <Planner />), (title = 'Reading plan'), (isRoot = false))
  else if (section === 'chapters' && !param) page = <ChapterList />
  else if (section === 'chapters') ((page = <ChapterDetail n={Number(param)} />), (title = `Chapter ${param}`), (isRoot = false))
  else if (section === 'cast' || (section === 'characters' && !param)) page = <Cast segment={(loc.query.get('seg') as 'people' | 'places' | 'things') ?? 'people'} />
  else if (section === 'map') ((page = <MapScreen focusId={param} />), (title = 'Connections'), (isRoot = false))
  else if (section === 'themes' && !param) ((page = <Themes />), (title = 'Themes'), (isRoot = false))
  else if (section === 'themes') ((page = <ThemePage themeId={param} />), (title = 'Theme'), (isRoot = false))
  else if (section === 'afterword') ((page = <Afterword />), (title = 'After you finish'), (isRoot = false))
  else if (section === 'timeline') ((page = <Timeline />), (title = 'Timeline'), (isRoot = false))
  else if (section === 'places' && param) ((page = <PlacePage id={param} />), (title = placeAt(book, param, upTo)?.name ?? 'Place'), (isRoot = false))
  else if (section === 'characters') {
    page = <CharacterProfile id={param} />
    title = book.characters.find((c) => c.id === param)?.name
    isRoot = false
  } else if (section === 'glossary') page = <Glossary />
  else return <NotFound />

  const note = noteId ? (book.notes.find((x) => x.id === noteId && x.chapter <= upTo) ?? null) : null

  return (
    <BookContext.Provider value={ctx}>
      <BookHeader
        book={book}
        upTo={upTo}
        current={tab}
        title={title}
        isRoot={isRoot}
        onBookmark={() => setBookmarkOpen(true)}
        onSearch={openSearch}
      />
      <main className="wrap screen">{page}</main>
      <TabBar bookId={id} current={tab} />
      <BookmarkSheet open={bookmarkOpen} onClose={() => setBookmarkOpen(false)} book={book} upTo={upTo} wpm={wpm} onSet={setBookmark} />
      <SearchOverlay ref={searchInput} open={searchOpen} onClose={() => setSearchOpen(false)} book={book} upTo={upTo} onNote={setNoteId} />
      <NoteSheet note={note} onClose={() => setNoteId(null)} book={book} upTo={upTo} />
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} bookId={id} />
    </BookContext.Provider>
  )
}
