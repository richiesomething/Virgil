import { useEffect, useState } from 'react'
import type { BookData } from '../types'
import Icon, { type IconName } from './Icon'
import { Ring } from './ui'
import { href, navigate } from '../lib/router'

export type Tab = 'today' | 'chapters' | 'cast' | 'glossary'

export const tabs: { id: Tab; label: string; icon: IconName; path: string }[] = [
  { id: 'today', label: 'Today', icon: 'today', path: '' },
  { id: 'chapters', label: 'Chapters', icon: 'chapters', path: 'chapters' },
  { id: 'cast', label: 'Cast', icon: 'cast', path: 'cast' },
  { id: 'glossary', label: 'Glossary', icon: 'glossary', path: 'glossary' },
]

export function tabOf(section: string | undefined): Tab {
  if (section === 'chapters') return 'chapters'
  if (section === 'cast' || section === 'characters' || section === 'map' || section === 'places') return 'cast'
  if (section === 'glossary') return 'glossary'
  return 'today'
}

/** Where each tab was last left, so switching tabs returns to it (like iOS). */
const lastInTab = new Map<string, string>()

export function rememberTab(bookId: string, tab: Tab, hash: string) {
  lastInTab.set(bookId + ':' + tab, hash)
}

function tabRoot(bookId: string, tab: Tab) {
  const t = tabs.find((x) => x.id === tab)!
  return t.path ? href('b', bookId, t.path) : href('b', bookId)
}

function goToTab(bookId: string, tab: Tab, current: Tab) {
  const root = tabRoot(bookId, tab)
  if (tab === current) {
    // Tapping the active tab pops back to its root, or scrolls to the top.
    if (window.location.hash === root) window.scrollTo({ top: 0, behavior: 'smooth' })
    else navigate(root)
    return
  }
  navigate(lastInTab.get(bookId + ':' + tab) ?? root, { restore: true })
}

export function TabBar({ bookId, current }: { bookId: string; current: Tab }) {
  return (
    <nav className="tabbar" aria-label="Book">
      <div className="tabbar__inner">
        {tabs.map((t) => (
          <a
            key={t.id}
            href={tabRoot(bookId, t.id)}
            aria-current={current === t.id ? 'page' : undefined}
            onClick={(e) => {
              e.preventDefault()
              goToTab(bookId, t.id, current)
            }}
          >
            <Icon name={t.icon} />
            {t.label}
          </a>
        ))}
      </div>
    </nav>
  )
}

interface HeaderProps {
  book: BookData
  upTo: number
  current: Tab
  /** Title for pushed screens; tab roots show the book title. */
  title?: string
  isRoot: boolean
  onBookmark: () => void
  onSearch: () => void
}

export function BookHeader({ book, upTo, current, title, isRoot, onBookmark, onSearch }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const total = book.meta.chapterCount
  const chipText = upTo === 0 ? 'Start' : upTo >= total ? 'Done' : `Ch ${upTo}`
  const back = () => {
    if (isRoot) navigate(href())
    else if (history.length > 1) history.back()
    else navigate(tabRoot(book.meta.id, current))
  }

  return (
    <header className={'book-header' + (scrolled ? ' is-scrolled' : '')}>
      <div className="book-header__inner">
        <button className="icon-btn" onClick={back} aria-label={isRoot ? 'Library' : 'Back'}>
          <Icon name={isRoot ? 'books' : 'back'} />
        </button>
        <div className="book-header__title">{isRoot ? (book.meta.shortTitle ?? book.meta.title) : (title ?? book.meta.shortTitle ?? book.meta.title)}</div>
        <nav className="desktop-tabs" aria-label="Book">
          {tabs.map((t) => (
            <a
              key={t.id}
              href={tabRoot(book.meta.id, t.id)}
              aria-current={current === t.id ? 'page' : undefined}
              onClick={(e) => {
                e.preventDefault()
                goToTab(book.meta.id, t.id, current)
              }}
            >
              {t.label}
            </a>
          ))}
        </nav>
        <div className="book-header__spacer" />
        <div className="book-header__actions">
          <button className="icon-btn" onClick={onSearch} aria-label="Search">
            <Icon name="search" />
          </button>
          <button
            className="bm-chip"
            onClick={onBookmark}
            aria-label={
              upTo === 0
                ? 'Bookmark: not started. Set your place'
                : `Bookmark: finished chapter ${upTo} of ${total}. Change`
            }
          >
            {upTo >= total ? <Icon name="check" className="icon--sm" /> : <Ring value={upTo / total} />}
            {chipText}
          </button>
        </div>
      </div>
    </header>
  )
}
