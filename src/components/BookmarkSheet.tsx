import { useEffect, useRef, useState } from 'react'
import type { BookData } from '../types'
import Icon from './Icon'
import { Sheet } from './ui'
import { chapterMinutes, estimate } from '../lib/planner'

interface Props {
  open: boolean
  onClose: () => void
  book: BookData
  upTo: number
  wpm: number
  onSet: (n: number) => void
}

/**
 * The core control. "I finished Chapter N" always means bookmark + 1; jumping
 * further ahead asks first, because it unlocks spoilers. Titles of chapters
 * ahead stay hidden.
 */
export default function BookmarkSheet({ open, onClose, book, upTo, wpm, onSet }: Props) {
  const total = book.meta.chapterCount
  const [choosing, setChoosing] = useState(false)
  const [pending, setPending] = useState<number | null>(null)
  const [jump, setJump] = useState('')
  const current = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) ((setChoosing(false), setPending(null)), setJump(''))
  }, [open])
  useEffect(() => {
    if (choosing) requestAnimationFrame(() => current.current?.scrollIntoView({ block: 'center' }))
  }, [choosing])

  const pick = (n: number) => {
    if (n === upTo) return
    if (n > upTo + 1) setPending(n)
    else onSet(n)
  }
  const label = (n: number) => {
    const ch = book.chapters[n - 1]
    return n <= upTo && ch?.title ? ch.title : `Chapter ${n}`
  }
  const pct = Math.round((upTo / total) * 100)
  const done = upTo >= total

  return (
    <Sheet open={open} onClose={onClose} label="Bookmark" size={choosing ? 'large' : 'content'}>
      <div className="bm-sheet">
        <div className="section-head">
          <p className="eyebrow">I’ve finished</p>
          <span className="small muted">{pct}%</span>
        </div>
        <h2 className="bm-sheet__current">
          {upTo === 0 ? 'Not started yet' : `Chapter ${upTo}${book.chapters[upTo - 1]?.title ? ' · ' + book.chapters[upTo - 1].title : ''}`}
        </h2>

        {pending !== null ? (
          <div className="callout bm-sheet__confirm">
            <p>
              <strong>
                Unlock chapters {upTo + 1}–{pending}?
              </strong>{' '}
              Summaries, notes and characters through chapter {pending} will appear.
            </p>
            <div className="bm-sheet__row">
              <button className="btn btn--primary" onClick={() => onSet(pending)}>
                Unlock {pending - upTo} chapters
              </button>
              <button className="btn btn--secondary" onClick={() => setPending(null)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            {!done && (
              <button className="btn btn--primary btn--lg btn--block" onClick={() => onSet(upTo + 1)}>
                <Icon name="check" />
                I finished Chapter {upTo + 1}
                <span className="bm-sheet__est">{estimate(book, chapterMinutes(book, upTo + 1, wpm))}</span>
              </button>
            )}
            <div className="bm-sheet__row">
              <button className="btn btn--secondary" onClick={() => onSet(upTo - 1)} disabled={upTo <= 0}>
                <Icon name="minus" className="icon--sm" /> Back one
              </button>
              <button className="btn btn--secondary" onClick={() => setChoosing(!choosing)} aria-expanded={choosing}>
                Choose chapter
              </button>
            </div>
          </>
        )}

        {choosing && pending === null && (
          <div className="bm-sheet__list">
            <form
              className="field"
              onSubmit={(e) => {
                e.preventDefault()
                const n = Number(jump)
                if (n >= 0 && n <= total) pick(n)
              }}
            >
              <Icon name="search" className="icon--sm" />
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder={`Jump to chapter (0–${total})`}
                value={jump}
                onChange={(e) => setJump(e.target.value.replace(/\D/g, ''))}
                aria-label="Jump to chapter number"
                enterKeyHint="go"
              />
            </form>
            <div className="group" role="list">
              <button className={'row' + (upTo === 0 ? ' is-current' : '')} onClick={() => pick(0)} role="listitem">
                <span className="ch-row__num">0</span>
                <span className="row__body">
                  <span className="row__title">Not started</span>
                </span>
              </button>
              {book.chapters.map((c) => (
                <button
                  key={c.number}
                  ref={c.number === upTo ? current : undefined}
                  className={'row bm-row' + (c.number <= upTo ? ' is-read' : '') + (c.number === upTo ? ' is-current' : '')}
                  onClick={() => pick(c.number)}
                  role="listitem"
                  aria-current={c.number === upTo ? 'true' : undefined}
                >
                  <span className="ch-row__num">{c.number}</span>
                  <span className="row__body">
                    <span className="row__title">{label(c.number)}</span>
                  </span>
                  <span className="row__meta">
                    {c.number === upTo ? 'You are here' : c.number > upTo ? <Icon name="lock" className="icon--sm" /> : null}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Sheet>
  )
}
