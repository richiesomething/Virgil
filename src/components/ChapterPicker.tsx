import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'
import { Sheet } from './ui'
import { useBook } from '../lib/book-context'
import { href, navigate } from '../lib/router'
import { chapterMinutes, estimate } from '../lib/planner'
import { prefs } from '../lib/store'
import { reading, resumeFor } from '../lib/text'
import { hasAudio } from '../lib/audio'

/**
 * Pick any chapter to read or listen to: the ones you've read (with their titles), the one you're on,
 * and the ones ahead (numbers only, so nothing is given away). Two taps from anywhere in the book.
 */
export default function ChapterPicker({ open, onClose, current }: { open: boolean; onClose: () => void; current?: number }) {
  const { book, upTo, openBookmark } = useBook()
  const id = book.meta.id
  const total = book.meta.chapterCount
  const wpm = prefs.use().wpm
  const listen = prefs.use().listen && hasAudio(book.meta)
  const positions = reading.use()
  const [jump, setJump] = useState('')
  const here = useRef<HTMLButtonElement>(null)
  const focus = current ?? Math.min(total, upTo + 1)

  useEffect(() => {
    if (open) {
      setJump('')
      requestAnimationFrame(() => here.current?.scrollIntoView({ block: 'center' }))
    }
  }, [open])

  const go = (n: number) => {
    onClose()
    navigate(href('b', id, 'read', n))
  }
  const title = (n: number) => (n <= upTo && book.chapters[n - 1]?.title ? book.chapters[n - 1].title : `Chapter ${n}`)
  const volumes = book.meta.volumes?.length ? book.meta.volumes : [{ number: 1, title: '', firstChapter: 1 }]

  return (
    <Sheet open={open} onClose={onClose} label="Read a chapter" size="large">
      <div className="picker">
        <div className="section-head">
          <p className="eyebrow">{listen ? 'Listen to' : 'Read'}</p>
          <span className="small muted">{upTo} of {total} read</span>
        </div>
        <h2 className="bm-sheet__current">Which chapter?</h2>
        <form
          className="bm-sheet__jump"
          onSubmit={(e) => {
            e.preventDefault()
            const n = Number(jump)
            if (n >= 1 && n <= total) go(n)
          }}
        >
          <Icon name="search" className="icon--sm" />
          <input inputMode="numeric" pattern="[0-9]*" placeholder={`Jump to chapter (1–${total})`} value={jump} onChange={(e) => setJump(e.target.value.replace(/\D/g, ''))} aria-label="Jump to chapter number" enterKeyHint="go" />
        </form>
        {volumes.map((v, vi) => {
          const last = volumes[vi + 1] ? volumes[vi + 1].firstChapter - 1 : total
          const nums = Array.from({ length: last - v.firstChapter + 1 }, (_, i) => v.firstChapter + i)
          return (
            <section key={v.number}>
              {v.title ? <h3 className="vol-head">{v.title}</h3> : null}
              <div className="group" role="list">
                {nums.map((n) => {
                  const pos = resumeFor(positions, id, n)
                  const state = n === current ? 'Reading now' : n === upTo + 1 ? 'Up next' : pos ? `${Math.round((pos.word / pos.words) * 100)}%` : ''
                  return (
                    <button
                      key={n}
                      ref={n === focus ? here : undefined}
                      className={'row bm-row' + (n <= upTo ? ' is-read' : '') + (n === focus ? ' is-current' : '')}
                      onClick={() => go(n)}
                      role="listitem"
                      aria-current={n === current ? 'true' : undefined}
                    >
                      <span className="ch-row__num">{n <= upTo ? <Icon name="check" className="icon--sm" /> : n}</span>
                      <span className="row__body">
                        <span className="row__title">{title(n)}</span>
                        <span className="row__sub">{estimate(book, chapterMinutes(book, n, wpm))}</span>
                      </span>
                      <span className="row__meta">{state}</span>
                      <Icon name="chevronRight" className="icon--sm chev" />
                    </button>
                  )
                })}
              </div>
            </section>
          )
        })}
        <p className="small muted picker__foot">
          Read some of it somewhere else?{' '}
          <button
            className="link"
            onClick={() => {
              onClose()
              openBookmark()
            }}
          >
            Move your bookmark
          </button>{' '}
          so Virgil’s notes catch up.
        </p>
      </div>
    </Sheet>
  )
}
