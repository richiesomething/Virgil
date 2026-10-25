import Icon from '../components/Icon'
import Primer from '../components/Primer'
import WhereCard from '../components/WhereCard'
import InsightCard from '../components/InsightCard'
import { insightsForChapter } from '../lib/understanding'
import { initials } from '../components/CharacterChip'
import { NoteBody, kindLabel } from '../components/Sheets'
import { Segmented } from '../components/ui'
import { useBook } from '../lib/book-context'
import { href, navigate, useLocation, withQuery } from '../lib/router'
import { chapter, charactersInChapter, currentTagline, kindOf, notesForChapter } from '../lib/spoilers'
import { prefs } from '../lib/store'
import { chapterMinutes, estimate } from '../lib/planner'

type Tab = 'summary' | 'insights' | 'notes' | 'people'

export default function ChapterDetail({ n }: { n: number }) {
  const { book, upTo } = useBook()
  const total = book.meta.chapterCount
  if (!Number.isInteger(n) || n < 1 || n > total) {
    return (
      <div className="empty">
        <h1>No such chapter</h1>
        <a className="btn btn--secondary" href={href('b', book.meta.id, 'chapters')}>
          All chapters
        </a>
      </div>
    )
  }
  if (n === upTo + 1) return <UpNextPage n={n} />
  if (n > upTo) {
    return (
      <div className="empty">
        <div style={{ display: 'grid', placeItems: 'center', marginBottom: 8 }}>
          <Icon name="lock" size={32} />
        </div>
        <h1>Chapter {n} is still ahead of you</h1>
        <p>Its summary, notes and characters unlock once you’ve finished it.</p>
        <a className="btn btn--primary" href={href('b', book.meta.id, 'chapters', upTo + 1)}>
          Go to Up next
        </a>
      </div>
    )
  }
  return <ReadChapter n={n} />
}

function ReadChapter({ n }: { n: number }) {
  const { book, upTo, openNote } = useBook()
  const loc = useLocation()
  const ch = chapter(book, n, upTo)!
  const { meta } = book
  const notes = notesForChapter(book, n, upTo)
  const noteCount = notes.introduced.length + notes.returning.length
  const people = charactersInChapter(book, ch, upTo)
  const insights = insightsForChapter(book, n, upTo)
  const requested = (loc.query.get('tab') as Tab) ?? 'summary'
  const tab: Tab = (requested === 'notes' && !noteCount) || (requested === 'insights' && !insights.length) ? 'summary' : requested
  const volume = meta.volumes.find((v) => v.number === ch.volume)
  const setTab = (t: Tab) => navigate(withQuery(href('b', meta.id, 'chapters', n), { tab: t === 'summary' ? undefined : t }), { replace: true })

  return (
    <article>
      <p className="eyebrow">
        {volume ? `${volume.title} · ` : ''}Chapter {n}
      </p>
      <h1 className="page-title">{ch.title || `Chapter ${n}`}</h1>
      <p className="lede">{ch.summary}</p>

      <div className="sticky-sub">
        <Segmented<Tab>
          label="Chapter sections"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'summary', label: 'Summary' },
            ...(insights.length ? [{ value: 'insights' as Tab, label: 'Insights', count: insights.length }] : []),
            ...(noteCount ? [{ value: 'notes' as Tab, label: 'Notes', count: noteCount }] : []),
            { value: 'people', label: 'People', count: people.length },
          ]}
        />
      </div>

      <div style={{ marginTop: 16 }}>
        {tab === 'summary' && <WhereCard n={n} />}
        {tab === 'summary' && (
          <div className="prose">
            {ch.details.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        )}

        {tab === 'summary' && insights.length > 0 && (
          <button className="card notice-teaser" onClick={() => setTab('insights')}>
            <span className="eyebrow">Worth noticing</span>
            <strong>{insights[0].title}</strong>
            <span className="muted small">
              {insights.length > 1 ? `and ${insights.length - 1} more` : 'Read the note'} <Icon name="chevronRight" className="icon--sm" />
            </span>
          </button>
        )}

        {tab === 'insights' && (
          <div className="insights">
            <p className="muted small" style={{ margin: '0 0 4px' }}>
              What’s worth noticing in this chapter.
            </p>
            {insights.map((i) => (
              <InsightCard key={i.id} insight={i} />
            ))}
            <a className="link" href={href('b', meta.id, 'themes')}>
              All themes <Icon name="chevronRight" className="icon--sm" />
            </a>
          </div>
        )}

        {tab === 'notes' && (
          <div>
            {notes.introduced.map((note) => (
              <div key={note.id} className="note-card">
                <div className="note-card__head">
                  <span className="note-card__term">{note.term}</span>
                  <span className="tag">{kindLabel[note.kind]}</span>
                </div>
                <NoteBody note={note} book={book} upTo={upTo} />
              </div>
            ))}
            {notes.returning.length > 0 && (
              <>
                <p className="group-title">Mentioned again</p>
                <div className="group">
                  {notes.returning.map((note) => (
                    <button key={note.id} className="row" onClick={() => openNote(note.id)}>
                      <span className="row__body">
                        <span className="row__title">{note.term}</span>
                        <span className="row__sub clamp-1">{note.text}</span>
                      </span>
                      <span className="row__meta">ch {note.chapter}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'people' && (
          <div className="group">
            {people.map((c) => (
              <a key={c.id} className="row row--avatar" href={href('b', meta.id, 'characters', c.id)}>
                <span className={`avatar avatar--sm avatar--${c.importance} avatar--${kindOf(c)}`} aria-hidden="true">
                  {initials(c.name)}
                </span>
                <span className="row__body">
                  <span className="row__title">{c.name}</span>
                  <span className="row__sub clamp-1">{currentTagline(c, upTo)}</span>
                </span>
                {c.firstChapter === n && <span className="tag tag--new">New</span>}
              </a>
            ))}
          </div>
        )}
      </div>

      <nav className="pager" aria-label="Chapter navigation">
        {n > 1 ? (
          <a href={href('b', meta.id, 'chapters', n - 1)}>
            <span className="k">
              <Icon name="back" className="icon--sm" /> Ch {n - 1}
            </span>
            <span className="t clamp-1">{book.chapters[n - 2].title || `Chapter ${n - 1}`}</span>
          </a>
        ) : (
          <span />
        )}
        {n < upTo ? (
          <a className="next" href={href('b', meta.id, 'chapters', n + 1)}>
            <span className="k">
              Ch {n + 1} <Icon name="chevronRight" className="icon--sm" />
            </span>
            <span className="t clamp-1">{book.chapters[n].title || `Chapter ${n + 1}`}</span>
          </a>
        ) : n < meta.chapterCount ? (
          <a className="next" href={href('b', meta.id, 'chapters', n + 1)}>
            <span className="k">
              Up next <Icon name="chevronRight" className="icon--sm" />
            </span>
            <span className="t">Chapter {n + 1}</span>
          </a>
        ) : (
          <span />
        )}
      </nav>
    </article>
  )
}

function UpNextPage({ n }: { n: number }) {
  const { book, upTo, setBookmark } = useBook()
  const { wpm } = prefs.use()
  const words = book.wordCounts[n - 1]
  return (
    <article>
      <p className="eyebrow">Up next</p>
      <h1 className="page-title">Chapter {n}</h1>
      <p className="muted" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon name="clock" className="icon--sm" />
        {estimate(book, chapterMinutes(book, n, wpm))}
        {words ? ` · ${book.meta.wordCountsApproximate ? 'about ' : ''}${words.toLocaleString()} words` : ''}
      </p>
      <Primer book={book} n={n} upTo={upTo} forceOpen />
      <p className="small muted">Its summary, notes and characters appear once you’ve finished it.</p>
      <div className="action-bar">
        <button className="btn btn--primary btn--lg btn--block" onClick={() => setBookmark(n)}>
          <Icon name="check" /> I finished Chapter {n}
        </button>
      </div>
    </article>
  )
}
