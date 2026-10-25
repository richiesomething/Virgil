import { useEffect, useState } from 'react'
import Icon from '../components/Icon'
import { SettingsSheet } from '../components/Sheets'
import { library, loadBook } from '../books'
import { useAllProgress } from '../lib/progress'
import { href } from '../lib/router'
import type { BookMeta } from '../types'

export function SiteHeader({ onSettings }: { onSettings?: () => void }) {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <a className="brand" href={href()}>
          <img className="brand__mark" src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width="32" height="32" />
          <span className="brand__name">Virgil</span>
        </a>
        {onSettings && (
          <button className="icon-btn" onClick={onSettings} aria-label="Settings">
            <Icon name="gear" />
          </button>
        )}
      </div>
    </header>
  )
}

export default function Library() {
  const progress = useAllProgress()
  const [settings, setSettings] = useState(false)
  const reading = library.filter((b) => (progress[b.id] ?? 0) > 0 && (progress[b.id] ?? 0) < b.chapterCount)
  const others = library.filter((b) => !reading.includes(b))
  const firstVisit = reading.length === 0 && others.every((b) => !progress[b.id])

  return (
    <>
      <SiteHeader onSettings={() => setSettings(true)} />
      <main className="wrap screen screen--no-tabs stack">
        {firstVisit && (
          <section>
            <h1 className="large-title">Your guide through difficult books</h1>
            <p className="muted" style={{ margin: 0 }}>
              Tell Virgil which chapter you’ve finished. Summaries, notes and characters stop at your bookmark — nothing later is spoiled.
            </p>
          </section>
        )}
        {reading.length > 0 && <Preload ids={reading.map((b) => b.id)} />}
        {reading.length > 0 && (
          <section>
            <h1 className="large-title" style={{ marginBottom: 12 }}>Continue reading</h1>
            <div className="stack" style={{ marginTop: 0 }}>
              {reading.map((b) => (
                <ContinueCard key={b.id} book={b} done={progress[b.id] ?? 0} />
              ))}
            </div>
          </section>
        )}
        <section>
          <h2 style={{ fontSize: '1.375rem', marginBottom: 10 }}>{reading.length ? 'Library' : 'Books'}</h2>
          <div className="group">
            {others.map((b) => {
              const done = progress[b.id] ?? 0
              return (
                <a key={b.id} className="row book-row" href={href('b', b.id)}>
                  <span className="cover" style={{ background: b.color }}>
                    <span className="cover__title">{b.title}</span>
                  </span>
                  <span className="row__body">
                    <span className="row__title">{b.title}</span>
                    <span className="row__sub">
                      {b.author} · {done >= b.chapterCount ? 'Finished' : `${b.chapterCount} chapters`}
                    </span>
                  </span>
                  <Icon name="chevronRight" className="icon--sm chev" />
                </a>
              )
            })}
          </div>
        </section>
        {!firstVisit && <p className="small muted">Virgil keeps everything to the chapter you’ve finished — no spoilers.</p>}
      </main>
      <SettingsSheet open={settings} onClose={() => setSettings(false)} />
    </>
  )
}

function ContinueCard({ book, done }: { book: BookMeta; done: number }) {
  return (
    <a className="card continue-card" href={href('b', book.id)}>
      <span className="cover" style={{ background: book.color }}>
        <span className="cover__title">{book.title}</span>
        <span className="cover__author">{book.author}</span>
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <h2>{book.title}</h2>
        <span className="muted small">
          Chapter {done + 1} next · {done} of {book.chapterCount} read
        </span>
        <span className="progress" style={{ display: 'block' }}>
          <span className="progress__fill" style={{ display: 'block', width: `${(done / book.chapterCount) * 100}%` }} />
        </span>
      </span>
      <Icon name="chevronRight" className="icon--sm chev" />
    </a>
  )
}

/** Fetch the books being read in the background, so opening one is instant. */
function Preload({ ids }: { ids: string[] }) {
  const key = ids.join()
  useEffect(() => {
    const t = setTimeout(() => key.split(',').forEach((id) => loadBook(id)?.catch(() => {})), 300)
    return () => clearTimeout(t)
  }, [key])
  return null
}
