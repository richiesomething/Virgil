import { hasTimeline } from '../lib/understanding'
import Icon from '../components/Icon'
import { useBook } from '../lib/book-context'
import { href } from '../lib/router'
import { unlockedChapters } from '../lib/spoilers'
import { prefs } from '../lib/store'
import { chapterMinutes, estimate } from '../lib/planner'
import type { BookMeta, Chapter } from '../types'

export default function ChapterList() {
  const { book, upTo, bookmark, reveal, openPicker } = useBook()
  const { wpm } = prefs.use()
  const { meta } = book
  const chapters = unlockedChapters(book, upTo)
  const next = bookmark < meta.chapterCount ? bookmark + 1 : null
  const remaining = meta.chapterCount - bookmark

  return (
    <div>
      <h1 className="large-title">Chapters</h1>
      <p className="muted" style={{ marginBottom: 8 }}>
        {bookmark === 0 ? `${meta.chapterCount} chapters` : `${bookmark} of ${meta.chapterCount} read`}
      </p>
      <button className="btn btn--secondary btn--block" style={{ marginBottom: 12 }} onClick={openPicker}>
        <Icon name="bookOpen" /> Read or listen to any chapter
      </button>
      {upTo > 0 && ((book.themes?.length ?? 0) > 0 || hasTimeline(book)) && (
        <div className="guide-pills">
          {(book.themes?.length ?? 0) > 0 && (
            <a className="pill-btn" href={href('b', book.meta.id, 'themes')}>
              <Icon name="sparkle" className="icon--sm" /> Themes
            </a>
          )}
          {hasTimeline(book) && (
            <a className="pill-btn" href={href('b', book.meta.id, 'timeline')}>
              <Icon name="clock" className="icon--sm" /> Timeline
            </a>
          )}
        </div>
      )}

      {groupByVolume(meta.volumes, chapters, meta.parts).map(({ title, part, chapters: inGroup }) => (
        <section key={title || 'all'}>
          {part && <h2 className="part-head">{part}</h2>}
          {title ? <h3 className="vol-head">{title}</h3> : <div style={{ height: 16 }} />}
          <div className="group">
            {inGroup.map((c) => (
              <a key={c.number} className="row ch-row" href={href('b', meta.id, 'chapters', c.number)}>
                <span className="ch-row__num">{c.number}</span>
                <span className="row__body">
                  <span className="row__title">{c.title || `Chapter ${c.number}`}</span>
                  <span className="row__sub clamp-2">{c.summary}</span>
                </span>
              </a>
            ))}
          </div>
        </section>
      ))}

      {next && (
        <div className="group" style={{ marginTop: 12 }}>
          <a className="row ch-row ch-row--next" href={href('b', meta.id, 'chapters', next)}>
            <span className="ch-row__num">{next}</span>
            <span className="row__body">
              <span className="row__title">Up next · Chapter {next}</span>
              <span className="row__sub">{estimate(book, chapterMinutes(book, next, wpm))}</span>
            </span>
            <Icon name="chevronRight" className="icon--sm chev" />
          </a>
        </div>
      )}

      {!reveal && remaining > 1 && next && (
        <details className="read-ahead">
          <summary className="locked-note">
            <Icon name="lock" className="icon--sm" />
            {`${remaining - 1} more chapter${remaining - 1 === 1 ? '' : 's'} after that. Their notes stay hidden until you reach them, but you can read ahead.`}
          </summary>
          <div className="group" style={{ marginTop: 8 }}>
            {Array.from({ length: remaining - 1 }, (_, i) => next + 1 + i).map((n) => (
              <a key={n} className="row ch-row" href={href('b', meta.id, 'read', n)}>
                <span className="ch-row__num">{n}</span>
                <span className="row__body">
                  <span className="row__title">Chapter {n}</span>
                  <span className="row__sub">{estimate(book, chapterMinutes(book, n, wpm))}</span>
                </span>
                <Icon name="chevronRight" className="icon--sm chev" />
              </a>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

/** In reading order; books without volumes get a single untitled group. */
function groupByVolume(volumes: BookMeta['volumes'], chapters: Chapter[], parts?: BookMeta['parts']) {
  if (!volumes.length) return chapters.length ? [{ title: '', part: '', chapters }] : []
  let lastPart = -1
  return volumes
    .map((v) => ({ title: v.title, partNo: v.part, chapters: chapters.filter((c) => c.volume === v.number) }))
    .filter((g) => g.chapters.length)
    .map((g) => {
      // The part heading shows over the first visible group of each part.
      const part = g.partNo && g.partNo !== lastPart ? (parts?.find((p) => p.number === g.partNo)?.title ?? '') : ''
      if (g.partNo) lastPart = g.partNo
      return { title: g.title, part, chapters: g.chapters }
    })
}
