import { hasTimeline } from '../lib/understanding'
import Icon from '../components/Icon'
import { useBook } from '../lib/book-context'
import { href } from '../lib/router'
import { unlockedChapters } from '../lib/spoilers'
import { prefs } from '../lib/store'
import { chapterMinutes, estimate } from '../lib/planner'
import type { BookMeta, Chapter } from '../types'

export default function ChapterList() {
  const { book, upTo } = useBook()
  const { wpm } = prefs.use()
  const { meta } = book
  const chapters = unlockedChapters(book, upTo)
  const next = upTo < meta.chapterCount ? upTo + 1 : null
  const remaining = meta.chapterCount - upTo

  return (
    <div>
      <h1 className="large-title">Chapters</h1>
      <p className="muted" style={{ marginBottom: 8 }}>
        {upTo === 0 ? `${meta.chapterCount} chapters` : `${upTo} of ${meta.chapterCount} read`}
      </p>
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

      {groupByVolume(meta.volumes, chapters).map(({ title, chapters: inGroup }) => (
        <section key={title || 'all'}>
          {title ? <h2 className="vol-head">{title}</h2> : <div style={{ height: 16 }} />}
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

      {remaining > 1 && (
        <p className="locked-note">
          <Icon name="lock" className="icon--sm" />
          {next ? `${remaining - 1} more chapter${remaining - 1 === 1 ? '' : 's'} after that, hidden until you reach them.` : ''}
        </p>
      )}
    </div>
  )
}

/** Newest first; books without volumes get a single untitled group. */
function groupByVolume(volumes: BookMeta['volumes'], chapters: Chapter[]) {
  const newestFirst = [...chapters].reverse()
  if (!volumes.length) return newestFirst.length ? [{ title: '', chapters: newestFirst }] : []
  return [...volumes]
    .reverse()
    .map((v) => ({ title: v.title, chapters: newestFirst.filter((c) => c.volume === v.number) }))
    .filter((g) => g.chapters.length)
}
