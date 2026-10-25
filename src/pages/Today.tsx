import { useState } from 'react'
import Icon from '../components/Icon'
import Primer from '../components/Primer'
import { initials } from '../components/CharacterChip'
import { Ring } from '../components/ui'
import { useBook } from '../lib/book-context'
import { href } from '../lib/router'
import { chapter, newInChapter, notesUpTo, recapFor, whoMattersNow } from '../lib/spoilers'
import { bestFrame, currentPlace } from '../lib/atlas'
import { activeThemes, afterwordFor, insightsForChapter, themeSummary } from '../lib/understanding'
import { atlasHref } from '../components/AtlasView'
import { planFor, plans, prefs } from '../lib/store'
import { chapterMinutes, estimate, formatMinutes, planStats } from '../lib/planner'

const dateFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })

export default function Today() {
  const { book, upTo, welcome } = useBook()
  const total = book.meta.chapterCount
  if (upTo === 0) return <NotStarted />
  if (upTo >= total) return <Finished />
  return (
    <div className="stack">
      {welcome && <WelcomeBack />}
      <UpNext />
      <PlannerStrip />
      <LeftOff />
      <ThemesNow />
      <StoryNow />
    </div>
  )
}

function WelcomeBack() {
  const { book, upTo, welcome, dismissWelcome } = useBook()
  const { wpm } = prefs.use()
  const last = chapter(book, upTo, upTo)!
  const { checkpoint, since } = recapFor(book, upTo)
  const words = (checkpoint?.text.join(' ').split(/\s+/).length ?? 0) + since.reduce((s, c) => s + c.summary.split(/\s+/).length, 0)
  const mins = Math.max(1, Math.ceil(words / wpm))
  const long = (welcome?.gapDays ?? 0) >= 30
  return (
    <section className="card welcome" aria-label="Welcome back">
      <h2>Welcome back.</h2>
      <p className="muted" style={{ margin: 0 }}>
        {long ? 'It’s been a while — here’s where things stand. ' : `It’s been ${welcome?.gapDays} days. `}
        You’d finished Chapter {upTo}
        {last.title ? <>, <em>{last.title}</em></> : ''}.
      </p>
      <div className="actions">
        <a className="btn btn--primary" href={href('b', book.meta.id, 'recap')} style={{ whiteSpace: 'nowrap' }}>
          Catch me up <span style={{ fontWeight: 500, opacity: 0.85 }}>· {mins} min</span>
        </a>
        <button className="btn btn--ghost" onClick={dismissWelcome}>
          I remember
        </button>
      </div>
    </section>
  )
}

function UpNext() {
  const { book, upTo, setBookmark } = useBook()
  const { wpm } = prefs.use()
  const n = upTo + 1
  const words = book.wordCounts[n - 1]
  return (
    <section aria-labelledby="up-next">
      <p className="eyebrow" id="up-next">Up next</p>
      <div className="card">
        <a href={href('b', book.meta.id, 'chapters', n)} style={{ color: 'inherit' }}>
          <h2 className="up-next__title">Chapter {n}</h2>
        </a>
        <p className="up-next__meta">
          <Icon name="clock" className="icon--sm" />
          {estimate(book, chapterMinutes(book, n, wpm))}
          {words ? ` · ${book.meta.wordCountsApproximate ? 'about ' : ''}${words.toLocaleString()} words` : ''}
        </p>
        <Primer book={book} n={n} upTo={upTo} />
        <button className="btn btn--primary btn--lg btn--block" onClick={() => setBookmark(n)}>
          <Icon name="check" /> I finished Chapter {n}
        </button>
      </div>
    </section>
  )
}

function PlannerStrip() {
  const { book, upTo } = useBook()
  const all = plans.use()
  const p = prefs.use()
  const plan = planFor(all, book.meta.id)
  const s = planStats(book, upTo, plan, p.wpm)
  const id = book.meta.id

  if (!plan.goal) {
    if (p.planPromptDismissed.includes(id)) return null
    return (
      <section aria-labelledby="plan-prompt">
        <div className="section-head">
          <p className="eyebrow" id="plan-prompt">Reading plan</p>
        </div>
        <div className="card">
          <p style={{ margin: '0 0 12px' }}>
            About <strong>{formatMinutes(s.remainingMinutes)}</strong> of reading left. Set a daily goal or a finish date and Virgil
            will keep you on pace.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <a className="btn btn--secondary" href={href('b', id, 'plan')} style={{ flex: 1 }}>
              Set a goal
            </a>
            <button className="btn btn--ghost" onClick={() => prefs.set((x) => ({ ...x, planPromptDismissed: [...x.planPromptDismissed, id] }))}>
              Not now
            </button>
          </div>
        </div>
      </section>
    )
  }

  const target = s.dailyTarget ?? 0
  return (
    <section aria-labelledby="today-reading">
      <div className="section-head">
        <p className="eyebrow" id="today-reading">Today’s reading</p>
        <a className="link" href={href('b', id, 'plan')}>
          Plan <Icon name="chevronRight" className="icon--sm" />
        </a>
      </div>
      <a className="card planner-strip" href={href('b', id, 'plan')} style={{ color: 'inherit', textDecoration: 'none' }}>
        <Ring value={target ? s.todayMinutes / target : 0} size={52} stroke={5} label={`${Math.round(s.todayMinutes)} of ${Math.round(target)} minutes today`} />
        <span className="planner-strip__text">
          <strong>
            {Math.round(s.todayMinutes)} of {Math.round(target)} min today
          </strong>
          <span className="muted">
            {s.streak > 0 ? `${s.streak}-day streak` : 'No streak yet'}
            {s.projectedFinish ? ` · Finish ≈ ${dateFmt.format(s.projectedFinish)}` : ''}
          </span>
        </span>
      </a>
    </section>
  )
}

function LeftOff() {
  const { book, upTo } = useBook()
  const ch = chapter(book, upTo, upTo)!
  const id = book.meta.id
  const here = currentPlace(book, upTo)
  const frame = here && bestFrame(book, here, upTo)
  const [insight] = insightsForChapter(book, upTo, upTo)
  return (
    <section aria-labelledby="left-off">
      <p className="eyebrow" id="left-off">Where you left off</p>
      <div className="card">
        {here && (
          <a className="where-line" href={frame ? atlasHref(id, { place: here.id, frame: frame.id }) : href('b', id, 'places', here.id)}>
            <Icon name="pin" className="icon--sm" /> {here.name}
          </a>
        )}
        <h3 style={{ fontSize: '1.25rem', marginBottom: 6 }}>
          Ch {ch.number}
          {ch.title ? ` · ${ch.title}` : ''}
        </h3>
        <p className="clamp-3" style={{ margin: 0 }}>
          {ch.summary}
        </p>
        {insight && (
          <a className="notice-line" href={href('b', id, 'chapters', ch.number) + '?tab=insights'}>
            <Icon name="sparkle" className="icon--sm" />
            <span>
              <span className="muted">Worth noticing: </span>
              {insight.title}
            </span>
          </a>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 4 }}>
          <a className="link" href={href('b', id, 'chapters', ch.number)}>
            Full summary <Icon name="chevronRight" className="icon--sm" />
          </a>
          <a className="link" href={href('b', id, 'recap')}>
            Story so far <Icon name="chevronRight" className="icon--sm" />
          </a>
        </div>
      </div>
    </section>
  )
}

function ThemesNow() {
  const { book, upTo } = useBook()
  const id = book.meta.id
  const themes = activeThemes(book, upTo, 3)
  if (!themes.length) return null
  return (
    <section aria-labelledby="themes-now">
      <div className="section-head">
        <p className="eyebrow" id="themes-now">Themes you’re following</p>
        <a className="link" href={href('b', id, 'themes')}>
          All <Icon name="chevronRight" className="icon--sm" />
        </a>
      </div>
      <div className="group">
        {themes.map((t) => (
          <a key={t.id} className="row" href={href('b', id, 'themes', t.id)}>
            <span className="row__body">
              <span className="row__title">{t.name}</span>
              <span className="row__sub clamp-1">{themeSummary(t, upTo)}</span>
            </span>
            <Icon name="chevronRight" className="icon--sm chev" />
          </a>
        ))}
      </div>
    </section>
  )
}

function StoryNow() {
  const { book, upTo } = useBook()
  const id = book.meta.id
  const fresh = newInChapter(book, upTo, upTo).filter((c) => (c.kind ?? 'character') === 'character')
  const top = whoMattersNow(book, upTo, 8)
  const people = [...fresh, ...top.filter((c) => !fresh.some((f) => f.id === c.id))].slice(0, 8)
  if (!people.length) return null
  return (
    <section aria-labelledby="story-now">
      <div className="section-head">
        <p className="eyebrow" id="story-now">In the story now</p>
        <a className="link" href={href('b', id, 'cast')}>
          All cast <Icon name="chevronRight" className="icon--sm" />
        </a>
      </div>
      <div className="story-now">
        {people.map((c) => {
          const isNew = fresh.some((f) => f.id === c.id)
          return (
            <a key={c.id} href={href('b', id, 'characters', c.id)}>
              <span className={`avatar avatar--lg avatar--${c.importance}`} aria-hidden="true">
                {initials(c.name)}
              </span>
              {isNew && (
                <>
                  <span className="dot-new" aria-hidden="true" />
                  <span className="sr-only">new</span>
                </>
              )}
              <span className="name">{c.name}</span>
            </a>
          )
        })}
      </div>
    </section>
  )
}

function NotStarted() {
  const { book, openBookmark, setBookmark } = useBook()
  const { meta } = book
  const [more, setMore] = useState(false)
  return (
    <div className="stack">
      <div className="hero-book">
        <div className="cover cover--lg" style={{ background: meta.color }}>
          <span className="cover__title">{meta.title}</span>
          <span className="cover__author">{meta.author}</span>
        </div>
        <div>
          <h1 className="page-title">{meta.title}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {meta.author} · {meta.year}
          </p>
        </div>
      </div>
      <div>
        <p className={more ? '' : 'clamp-3'} style={{ margin: 0 }}>
          {meta.blurb}
        </p>
        {meta.blurb.length > 140 && (
          <button className="link" onClick={() => setMore(!more)}>
            {more ? 'Less' : 'More'}
          </button>
        )}
      </div>
      <div className="card">
        <h2 style={{ marginBottom: 6 }}>Where are you in the book?</h2>
        <p className="muted">Virgil shows summaries, notes and characters only up to the chapter you’ve finished.</p>
        <Primer book={book} n={1} upTo={0} />
        <button className="btn btn--primary btn--lg btn--block" onClick={() => setBookmark(1)}>
          <Icon name="check" /> I finished Chapter 1
        </button>
        <div style={{ textAlign: 'center' }}>
          <button className="link" onClick={openBookmark}>
            I’m already partway through
          </button>
        </div>
      </div>
      <p className="small muted">Summaries follow the {meta.edition}.</p>
    </div>
  )
}

function Finished() {
  const { book, upTo } = useBook()
  const all = plans.use()
  const { wpm } = prefs.use()
  const plan = planFor(all, book.meta.id)
  const s = planStats(book, upTo, plan, wpm)
  const id = book.meta.id
  const first = plan.log.length ? new Date(Math.min(...plan.log.map((e) => new Date(e.at).getTime()))) : null
  const days = first ? Math.max(1, Math.ceil((Date.now() - first.getTime()) / 86_400_000)) : null
  const hours = Math.round(book.wordCounts.reduce((a, b) => a + b, 0) / wpm / 60)
  return (
    <div className="stack">
      <section className="card" style={{ textAlign: 'center' }}>
        <div style={{ color: 'var(--gold)', display: 'grid', placeItems: 'center', marginBottom: 8 }}>
          <Icon name="laurel" size={40} />
        </div>
        <h1 className="page-title">
          You’ve finished <em>{book.meta.title}</em>.
        </h1>
        <p className="muted">
          {book.meta.chapterCount} chapters{days ? ` over ${days} days` : ''} · ~{hours} hours
          {s.bestStreak > 1 ? ` · best streak ${s.bestStreak} days` : ''}
        </p>
        <p style={{ margin: 0 }}>Everything is open to you now — the full cast, every note, the whole map.</p>
      </section>
      {afterwordFor(book, upTo) && (
        <a className="card afterword-card" href={href('b', id, 'afterword')}>
          <p className="eyebrow">After you finish</p>
          <h2>The full picture</h2>
          <p className="muted" style={{ margin: 0 }}>
            The ending explained, how the themes resolve, the big debates, and what to read next.
          </p>
          <span className="link">
            Read it <Icon name="chevronRight" className="icon--sm" />
          </span>
        </a>
      )}
      <div className="group">
        <a className="row" href={href('b', id, 'recap')}>
          <span className="row__body">
            <span className="row__title">The whole story</span>
          </span>
          <Icon name="chevronRight" className="icon--sm chev" />
        </a>
        <a className="row" href={href('b', id, 'cast')}>
          <span className="row__body">
            <span className="row__title">Browse the full cast</span>
          </span>
          <Icon name="chevronRight" className="icon--sm chev" />
        </a>
        {(book.themes?.length ?? 0) > 0 && (
          <a className="row" href={href('b', id, 'themes')}>
            <span className="row__body">
              <span className="row__title">Themes · {book.themes!.length}</span>
            </span>
            <Icon name="chevronRight" className="icon--sm chev" />
          </a>
        )}
        <a className="row" href={href('b', id, 'glossary')}>
          <span className="row__body">
            <span className="row__title">Glossary · {notesUpTo(book, upTo).length} terms</span>
          </span>
          <Icon name="chevronRight" className="icon--sm chev" />
        </a>
      </div>
    </div>
  )
}
