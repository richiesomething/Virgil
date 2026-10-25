import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Icon from '../components/Icon'
import { Segmented } from '../components/ui'
import { useBook } from '../lib/book-context'
import { href, navigate } from '../lib/router'
import { prefs } from '../lib/store'
import { useCopy } from '../lib/copies'
import { getChapterText, reading, resumeFor, savePos, textSource } from '../lib/text'
import { msFor, rampFactor, sentenceStartAfter, sentenceStartBefore, tokenize, type ChapterTokens } from '../lib/rsvp'
import { chapter } from '../lib/spoilers'

type View = 'flash' | 'text'

const MIN_WPM = 100
const MAX_WPM = 900
const STEP = 25

/** The book's own text, one word at a time. Full screen: no header or tab bar. */
export default function Reader({ n }: { n: number }) {
  const { book, upTo } = useBook()
  const id = book.meta.id
  const total = book.meta.chapterCount
  const copy = useCopy(id)
  const source = textSource(book.meta, copy.status === 'ready' ? copy.info : null)

  if (!Number.isInteger(n) || n < 1 || n > total) return <ReaderShell n={n} title="No such chapter" message="" link={{ href: href('b', id, 'chapters'), label: 'All chapters' }} />
  if (n > upTo + 1)
    return (
      <ReaderShell
        n={n}
        title={`Chapter ${n} is still ahead of you`}
        message="Chapters open in order: finish the one before it first."
        link={{ href: href('b', id, 'read', upTo + 1), label: `Read chapter ${upTo + 1}` }}
      />
    )
  if (source === 'none') {
    if (copy.status === 'loading') return <ReaderShell n={n} title="" message="Opening the book…" />
    return (
      <ReaderShell
        n={n}
        title="Virgil doesn’t have this book’s text"
        message="It’s still in copyright. Add your own copy (EPUB, PDF or text) and it stays on this device."
        link={{ href: href('b', id, 'text'), label: 'Add your copy' }}
      />
    )
  }
  return <ChapterReader key={`${id}/${n}`} n={n} />
}

function ReaderShell({ n, title, message, link }: { n: number; title: string; message: string; link?: { href: string; label: string } }) {
  const { book } = useBook()
  return (
    <div className="reader">
      <ReaderTop n={n} />
      <div className="reader__stage">
        <div className="empty">
          {title && <h1>{title}</h1>}
          {message && <p>{message}</p>}
          {link && (
            <a className="btn btn--primary" href={link.href}>
              {link.label}
            </a>
          )}
          <a className="link" href={href('b', book.meta.id)}>
            Back to Virgil
          </a>
        </div>
      </div>
    </div>
  )
}

function closeReader(bookId: string, n: number, upTo: number) {
  if (history.length > 1) history.back()
  else navigate(n <= upTo ? href('b', bookId, 'chapters', n) : href('b', bookId))
}

function ReaderTop({ n, right, timeLeft }: { n: number; right?: React.ReactNode; timeLeft?: string }) {
  const { book, upTo } = useBook()
  const ch = n <= upTo ? chapter(book, n, upTo) : null
  return (
    <div className="reader__top">
      <button className="icon-btn" aria-label="Close the reader" onClick={() => closeReader(book.meta.id, n, upTo)}>
        <Icon name="x" />
      </button>
      <span className="reader__label">
        <strong>Chapter {n}</strong>
        {ch?.title ? <span className="muted"> · {ch.title}</span> : null}
        {timeLeft ? <span className="muted"> · {timeLeft}</span> : null}
      </span>
      {right}
    </div>
  )
}

function ChapterReader({ n }: { n: number }) {
  const { book, upTo, setBookmark } = useBook()
  const id = book.meta.id
  const total = book.meta.chapterCount
  const { rsvpWpm: wpm } = prefs.use()
  const [chapterTokens, setTokens] = useState<ChapterTokens | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<View>('flash')
  const [playing, setPlaying] = useState(false)
  const [ended, setEnded] = useState(false)
  /** The word shown while paused (the scheduler keeps its own counter while playing). */
  const [paused, setPausedIndex] = useState(0)
  const idx = useRef(0)
  const timer = useRef(0)
  const nextAt = useRef(0)
  const sincePlay = useRef(0)
  const lastSave = useRef(0)
  const wake = useRef<WakeLockSentinel | null>(null)
  const before = useRef<HTMLSpanElement>(null)
  const pivot = useRef<HTMLSpanElement>(null)
  const after = useRef<HTMLSpanElement>(null)
  const bar = useRef<HTMLInputElement>(null)
  const wpmRef = useRef(wpm)
  wpmRef.current = wpm

  // Load and tokenize the chapter; resume where the reader left off.
  useEffect(() => {
    let live = true
    getChapterText(book, n)
      .then((paragraphs) => {
        if (!live) return
        const t = tokenize(paragraphs)
        const resume = resumeFor(reading.get(), id, n)
        idx.current = resume ? Math.min(resume.word, t.tokens.length - 1) : 0
        setPausedIndex(idx.current)
        setTokens(t)
      })
      .catch((e: Error) => live && setError(e.message))
    return () => {
      live = false
    }
  }, [book, id, n])

  // Running total of word weights, for the time-left estimate.
  const cumulative = useMemo(() => {
    if (!chapterTokens) return [0]
    const out = new Array<number>(chapterTokens.tokens.length + 1)
    out[0] = 0
    chapterTokens.tokens.forEach((t, i) => (out[i + 1] = out[i] + t.weight))
    return out
  }, [chapterTokens])

  const count = chapterTokens?.tokens.length ?? 0

  const show = useCallback(
    (i: number) => {
      const t = chapterTokens!.tokens[i]
      if (before.current && pivot.current && after.current) {
        before.current.textContent = t.text.slice(0, t.pivot)
        pivot.current.textContent = t.text[t.pivot] ?? ''
        after.current.textContent = t.text.slice(t.pivot + 1)
      }
      if (bar.current && (i % 10 === 0 || i === count - 1)) bar.current.value = String(i)
    },
    [chapterTokens, count],
  )

  const persist = useCallback(
    (word: number) => {
      if (count) savePos(id, { chapter: n, word, words: count })
      lastSave.current = performance.now()
    },
    [count, id, n],
  )

  const stop = useCallback(() => {
    clearTimeout(timer.current)
    wake.current?.release().catch(() => {})
    wake.current = null
  }, [])

  const pause = useCallback(() => {
    stop()
    setPlaying(false)
    setPausedIndex(idx.current)
    persist(idx.current)
  }, [persist, stop])

  const finish = useCallback(() => {
    stop()
    setPlaying(false)
    idx.current = count - 1
    setPausedIndex(idx.current)
    setEnded(true)
    if (count) savePos(id, { chapter: n, word: count, words: count })
  }, [count, id, n, stop])

  const tick = useCallback(() => {
    const i = idx.current
    show(i)
    const now = performance.now()
    if (now - lastSave.current > 2000) persist(i)
    const ms = msFor(chapterTokens!.tokens[i], wpmRef.current) * rampFactor(sincePlay.current++)
    nextAt.current = Math.max(now, nextAt.current) + ms
    timer.current = window.setTimeout(() => {
      if (idx.current + 1 >= count) return finish()
      idx.current += 1
      tick()
    }, nextAt.current - now)
  }, [chapterTokens, count, finish, persist, show])

  const play = useCallback(() => {
    if (!chapterTokens || ended) return
    sincePlay.current = 0
    nextAt.current = 0
    setPlaying(true)
    setView('flash')
    navigator.wakeLock?.request('screen').then((w) => (wake.current = w)).catch(() => {})
    tick()
  }, [chapterTokens, ended, tick])

  const seek = useCallback(
    (i: number) => {
      stop()
      setPlaying(false)
      setEnded(false)
      idx.current = Math.max(0, Math.min(count - 1, i))
      setPausedIndex(idx.current)
      show(idx.current)
      if (bar.current) bar.current.value = String(idx.current)
      persist(idx.current)
    },
    [count, persist, show, stop],
  )

  const toggle = useCallback(() => (playing ? pause() : play()), [pause, play, playing])
  const setWpm = useCallback((v: number) => prefs.set((p) => ({ ...p, rsvpWpm: Math.max(MIN_WPM, Math.min(MAX_WPM, v)) })), [])

  // First paint of the word once the text is in, and the position when switching views.
  useEffect(() => {
    if (chapterTokens && view === 'flash' && !playing) show(idx.current)
  }, [chapterTokens, view, playing, show])

  // Pause when the page is hidden, and save when leaving.
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && pause()
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('blur', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('blur', onHide)
      stop()
      if (!ended && count) savePos(id, { chapter: n, word: idx.current, words: count })
    }
  }, [count, ended, id, n, pause, stop])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' && e.key !== 'Escape') return
      if (e.key === ' ') ((e.preventDefault()), toggle())
      else if (e.key === 'ArrowLeft') seek(sentenceStartBefore(chapterTokens!, idx.current, true))
      else if (e.key === 'ArrowRight') seek(sentenceStartAfter(chapterTokens!, idx.current))
      else if (e.key === 'ArrowUp') setWpm(wpmRef.current + STEP)
      else if (e.key === 'ArrowDown') setWpm(wpmRef.current - STEP)
      else if (e.key === 'Escape') closeReader(id, n, upTo)
    }
    if (!chapterTokens) return
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [chapterTokens, id, n, seek, setWpm, toggle, upTo])

  // Prefetch the next chapter near the end of this one.
  useEffect(() => {
    if (chapterTokens && n < total && n + 1 <= upTo + 1 && paused > count * 0.8) getChapterText(book, n + 1).catch(() => {})
  }, [book, chapterTokens, count, n, paused, total, upTo])

  if (error) return <ReaderShell n={n} title="Couldn’t load this chapter" message={error} link={{ href: href('b', id, 'read', n), label: 'Try again' }} />
  if (!chapterTokens) return <ReaderShell n={n} title="" message="Opening the chapter…" />

  const minutesLeft = Math.ceil(((cumulative[count] - cumulative[Math.min(paused, count)]) * (60000 / wpm)) / 60000)
  const timeLeft = ended ? undefined : playing ? undefined : `${minutesLeft} min left`

  if (ended) {
    const done = n <= upTo
    const last = n >= total
    return (
      <div className="reader">
        <ReaderTop n={n} />
        <div className="reader__stage">
          <div className="reader__end">
            <p className="eyebrow">{done ? 'Read again' : 'The end of'}</p>
            <h1 className="page-title">Chapter {n}</h1>
            {last ? (
              <>
                <p className="muted">That’s the whole book.</p>
                <button
                  className="btn btn--primary btn--lg btn--block"
                  onClick={() => {
                    if (!done) setBookmark(n)
                    navigate(href('b', id))
                  }}
                >
                  <Icon name="check" /> {done ? 'Back to Virgil' : `I finished Chapter ${n}`}
                </button>
              </>
            ) : done ? (
              <button className="btn btn--primary btn--lg btn--block" onClick={() => navigate(href('b', id, 'read', n + 1))}>
                Next chapter <Icon name="chevronRight" />
              </button>
            ) : (
              <>
                <p className="muted">Mark it finished and Virgil opens its summary, notes and people.</p>
                <button
                  className="btn btn--primary btn--lg btn--block"
                  onClick={() => {
                    setBookmark(n)
                    navigate(href('b', id, 'read', n + 1))
                  }}
                >
                  <Icon name="check" /> Finished · read Chapter {n + 1}
                </button>
                <button
                  className="btn btn--secondary btn--block"
                  onClick={() => {
                    setBookmark(n)
                    navigate(href('b', id, 'chapters', n))
                  }}
                >
                  Finished · back to Virgil
                </button>
              </>
            )}
            <button className="link" onClick={() => seek(0)}>
              Read it again
            </button>
          </div>
        </div>
      </div>
    )
  }

  const tokens = chapterTokens.tokens
  const sentence = view === 'flash' && !playing ? tokens.slice(sentenceStartBefore(chapterTokens, paused), sentenceStartAfter(chapterTokens, paused)) : []
  const sentenceStart = sentenceStartBefore(chapterTokens, paused)

  return (
    <div className="reader" data-playing={playing || undefined}>
      <ReaderTop
        n={n}
        timeLeft={timeLeft}
        right={
          <Segmented<View>
            label="Reader view"
            value={view}
            onChange={(v) => {
              if (v === 'text') pause()
              setView(v)
            }}
            options={[
              { value: 'flash', label: 'Flash' },
              { value: 'text', label: 'Text' },
            ]}
          />
        }
      />

      {view === 'flash' ? (
        <button className="reader__stage reader__tap" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
          <span className="rsvp" aria-hidden="true">
            <span className="rsvp__before" ref={before} />
            <span className="rsvp__pivot" ref={pivot} />
            <span className="rsvp__after" ref={after} />
          </span>
          {!playing && (
            <span className="reader__context">
              {sentence.map((t, i) => (
                <span
                  key={i}
                  className={sentenceStart + i === paused ? 'is-current' : undefined}
                  onClick={(e) => {
                    e.stopPropagation()
                    seek(sentenceStart + i)
                  }}
                >
                  {t.text}{' '}
                </span>
              ))}
            </span>
          )}
          {!playing && <span className="reader__hint muted small">Tap to {paused > 0 ? 'continue' : 'start'}</span>}
        </button>
      ) : (
        <TextView chapter={chapterTokens} current={paused} onPick={(i) => ((seek(i)), setView('flash'))} />
      )}

      <div className="reader__controls">
        <input
          ref={bar}
          className="reader__bar"
          type="range"
          min={0}
          max={Math.max(0, count - 1)}
          defaultValue={paused}
          aria-label="Position in the chapter"
          aria-valuetext={`Word ${paused + 1} of ${count}`}
          onChange={(e) => seek(Number(e.target.value))}
        />
        <div className="reader__row">
          <button className="icon-btn" aria-label="Back a sentence" onClick={() => seek(sentenceStartBefore(chapterTokens, idx.current, true))}>
            <Icon name="skipBack" />
          </button>
          <button className="reader__play" aria-label={playing ? 'Pause' : 'Play'} onClick={toggle}>
            <Icon name={playing ? 'pause' : 'play'} size={28} />
          </button>
          <button className="icon-btn" aria-label="Forward a sentence" onClick={() => seek(sentenceStartAfter(chapterTokens, idx.current))}>
            <Icon name="skipForward" />
          </button>
          <span className="reader__speed" role="group" aria-label="Speed">
            <button className="icon-btn" aria-label="Slower" onClick={() => setWpm(wpm - STEP)} disabled={wpm <= MIN_WPM}>
              <Icon name="minus" />
            </button>
            <span className="reader__wpm">
              <strong>{wpm}</strong> wpm
            </span>
            <button className="icon-btn" aria-label="Faster" onClick={() => setWpm(wpm + STEP)} disabled={wpm >= MAX_WPM}>
              <Icon name="plus" />
            </button>
          </span>
        </div>
      </div>
    </div>
  )
}

/** The chapter as scrollable text, with the current word marked. Tap a paragraph to read from there. */
function TextView({ chapter, current, onPick }: { chapter: ChapterTokens; current: number; onPick: (i: number) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const currentPara = chapter.tokens[current]?.paragraph ?? 0
  useEffect(() => {
    ;(ref.current?.querySelector('.reader__word') ?? ref.current?.querySelector('.is-current'))?.scrollIntoView({ block: 'center' })
  }, [])
  const paragraphs = useMemo(() => {
    const out: { tokens: typeof chapter.tokens; start: number }[] = []
    chapter.paragraphStarts.forEach((start, i) => {
      const end = chapter.paragraphStarts[i + 1] ?? chapter.tokens.length
      out.push({ tokens: chapter.tokens.slice(start, end), start })
    })
    return out
  }, [chapter])
  return (
    <div className="reader__stage reader__text prose" ref={ref}>
      {paragraphs.map((p) => {
        const here = p.tokens[0].paragraph === currentPara
        return (
          <p key={p.start} className={here ? 'is-current' : undefined} onClick={() => onPick(p.start)}>
            {here
              ? p.tokens.map((t, i) => (
                  <span key={i} className={p.start + i === current ? 'reader__word' : undefined}>
                    {t.text}{' '}
                  </span>
                ))
              : p.tokens.map((t) => t.text).join(' ')}
          </p>
        )
      })}
    </div>
  )
}
