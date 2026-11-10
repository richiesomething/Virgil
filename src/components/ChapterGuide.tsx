import { useState } from 'react'
import Icon from './Icon'
import InsightCard from './InsightCard'
import Primer from './Primer'
import { initials } from './CharacterChip'
import { NoteBody, kindLabel } from './Sheets'
import { Segmented } from './ui'
import { useBook } from '../lib/book-context'
import { href } from '../lib/router'
import { chapter, charactersInChapter, currentTagline, kindOf, notesForChapter } from '../lib/spoilers'
import { insightsForChapter } from '../lib/understanding'

type Tab = 'insights' | 'notes' | 'people' | 'summary'

/**
 * The companion for chapter n, for use inside the reader: insights, notes, people and the summary,
 * so a reader can look something up without leaving the page (or stopping the narration).
 * A chapter the bookmark hasn't reached shows only its "Before you read".
 */
export default function ChapterGuide({ n }: { n: number }) {
  const { book, upTo } = useBook()
  const id = book.meta.id
  const ch = n <= upTo ? chapter(book, n, upTo) : null
  const insights = ch ? insightsForChapter(book, n, upTo) : []
  const notes = ch ? notesForChapter(book, n, upTo) : { introduced: [], returning: [] }
  const noteCount = notes.introduced.length + notes.returning.length
  const people = ch ? charactersInChapter(book, ch, upTo) : []
  const tabs: { value: Tab; label: string; count?: number }[] = [
    ...(insights.length ? [{ value: 'insights' as Tab, label: 'Insights', count: insights.length }] : []),
    ...(noteCount ? [{ value: 'notes' as Tab, label: 'Notes', count: noteCount }] : []),
    ...(people.length ? [{ value: 'people' as Tab, label: 'People', count: people.length }] : []),
    { value: 'summary', label: 'Summary' },
  ]
  const [picked, setTab] = useState<Tab | null>(null)
  const tab = picked && tabs.some((t) => t.value === picked) ? picked : tabs[0].value

  if (!ch) {
    return (
      <div className="guide">
        <Primer book={book} n={n} upTo={upTo} forceOpen />
        <p className="muted small">This chapter’s insights, notes and people open once you’ve finished it.</p>
      </div>
    )
  }

  return (
    <div className="guide">
      <Segmented<Tab> label="Chapter guide" value={tab} onChange={setTab} options={tabs} />
      <div className="guide__body">
        {tab === 'insights' && (
          <div className="insights">
            {insights.map((i) => (
              <InsightCard key={i.id} insight={i} />
            ))}
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
                {notes.returning.map((note) => (
                  <div key={note.id} className="note-card">
                    <div className="note-card__head">
                      <span className="note-card__term">{note.term}</span>
                      <span className="tag">ch {note.chapter}</span>
                    </div>
                    <NoteBody note={note} book={book} upTo={upTo} />
                  </div>
                ))}
              </>
            )}
          </div>
        )}
        {tab === 'people' && (
          <div className="group">
            {people.map((c) => (
              <a key={c.id} className="row row--avatar" href={href('b', id, 'characters', c.id)}>
                <span className={`avatar avatar--sm avatar--${c.importance} avatar--${kindOf(c)}`} aria-hidden="true">
                  {initials(c.name)}
                </span>
                <span className="row__body">
                  <span className="row__title">{c.name}</span>
                  <span className="row__sub clamp-2">{currentTagline(c, upTo)}</span>
                </span>
              </a>
            ))}
          </div>
        )}
        {tab === 'summary' && <p className="lede">{ch.summary}</p>}
      </div>
      <a className="btn btn--secondary btn--block" href={href('b', id, 'chapters', n) + (tab === 'summary' ? '' : `?tab=${tab}`)}>
        Open the chapter page <Icon name="chevronRight" className="icon--sm" />
      </a>
    </div>
  )
}
