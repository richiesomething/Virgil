import Icon from './Icon'
import { placeAt } from '../lib/atlas'
import type { BookData, Note, NoteKind } from '../types'
import { Segmented, Sheet, leaveSheetTo } from './ui'
import { href } from '../lib/router'
import { prefs, applyTheme, type PrimerMode, type Theme } from '../lib/store'
import { library } from '../books'
import { useCopy } from '../lib/copies'

export const kindLabel: Record<NoteKind, string> = {
  word: 'Word',
  title: 'Title',
  money: 'Money',
  history: 'History',
  reference: 'Reference',
  foreign: 'Foreign',
  custom: 'Custom',
  place: 'Place',
  lore: 'Lore',
}

/** A note card's content, shared by the Notes tab and the note sheet. */
export function NoteBody({ note, book, upTo, inSheet }: { note: Note; book: BookData; upTo: number; inSheet?: boolean }) {
  // Only show later appearances the reader has already reached.
  const seeAlso = (note.seeAlso ?? []).filter((c) => c <= upTo)
  const go = (n: number) => (inSheet ? leaveSheetTo(href('b', book.meta.id, 'chapters', n)) : (window.location.hash = href('b', book.meta.id, 'chapters', n)))
  const place = note.placeId ? placeAt(book, note.placeId, upTo) : undefined
  const placeHref = place && href('b', book.meta.id, 'places', place.id)
  return (
    <>
      <p className="note-card__text">{note.text}</p>
      {note.quote && <blockquote className="quote">“{note.quote}”</blockquote>}
      {seeAlso.length > 0 && (
        <div className="see-also">
          <span>Also in</span>
          {seeAlso.map((c) => (
            <button key={c} onClick={() => go(c)}>
              Ch. {c}
            </button>
          ))}
        </div>
      )}
      {placeHref && (
        <button className="link" style={{ marginTop: 8 }} onClick={() => (inSheet ? leaveSheetTo(placeHref) : (window.location.hash = placeHref))}>
          <Icon name="pin" className="icon--sm" /> {place!.name} on the map
        </button>
      )}
    </>
  )
}

export function NoteSheet({ note, onClose, book, upTo }: { note: Note | null; onClose: () => void; book: BookData; upTo: number }) {
  return (
    <Sheet open={!!note} onClose={onClose} label={note?.term ?? 'Note'}>
      {note && (
        <div className="note-sheet">
          <div className="note-card__head">
            <h2 className="note-sheet__term">{note.term}</h2>
            <span className="tag">{kindLabel[note.kind]}</span>
          </div>
          <button className="link" onClick={() => leaveSheetTo(href('b', book.meta.id, 'chapters', note.chapter))}>
            First noted in Chapter {note.chapter}
          </button>
          <NoteBody note={note} book={book} upTo={upTo} inSheet />
        </div>
      )}
    </Sheet>
  )
}

export function SettingsSheet({ open, onClose, bookId }: { open: boolean; onClose: () => void; bookId?: string }) {
  const p = prefs.use()
  const hiddenHere = !!bookId && p.primersHidden.includes(bookId)
  return (
    <Sheet open={open} onClose={onClose} title="Settings">
      <p className="group-title">Before you read</p>
      <Segmented<PrimerMode>
        label="Primers"
        value={hiddenHere ? 'off' : p.primers}
        onChange={(v) =>
          prefs.set((x) => ({
            ...x,
            primers: v,
            primersHidden: bookId ? x.primersHidden.filter((b) => b !== bookId) : x.primersHidden,
          }))
        }
        options={[
          { value: 'collapsed', label: 'Collapsed' },
          { value: 'expanded', label: 'Expanded' },
          { value: 'off', label: 'Off' },
        ]}
      />
      <p className="small muted" style={{ margin: '8px 4px 0' }}>
        Short, spoiler-free notes about the next chapter: where you are, and who’s coming back.
      </p>

      <p className="group-title">Appearance</p>
      <Segmented<Theme>
        label="Theme"
        value={p.theme}
        onChange={(v) => {
          prefs.set((x) => ({ ...x, theme: v }))
          applyTheme(v)
        }}
        options={[
          { value: 'system', label: 'System' },
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
        ]}
      />

      <p className="group-title">Reading speed</p>
      <p className="small muted" style={{ margin: '0 4px' }}>
        Estimates assume {p.wpm} words a minute. Change it in the reading plan.
      </p>
      <div className="speed-row" role="group" aria-label="Flash reader speed">
        <span>
          Flash reader: <strong>{p.rsvpWpm}</strong> words a minute
        </span>
        <span>
          <button className="icon-btn" aria-label="Slower" onClick={() => prefs.set((x) => ({ ...x, rsvpWpm: Math.max(100, x.rsvpWpm - 25) }))}>
            <Icon name="minus" />
          </button>
          <button className="icon-btn" aria-label="Faster" onClick={() => prefs.set((x) => ({ ...x, rsvpWpm: Math.min(900, x.rsvpWpm + 25) }))}>
            <Icon name="plus" />
          </button>
        </span>
      </div>
      <YourCopies bookId={bookId} />
      <p className="small muted" style={{ margin: '24px 4px 0' }}>
        Your bookmarks and reading history are saved in this browser only.
      </p>
    </Sheet>
  )
}

/** For books Virgil can't ship the text of: where the reader's own copy stands. */
function YourCopies({ bookId }: { bookId?: string }) {
  const books = library.filter((b) => b.text?.status !== 'shipped' && (!bookId || b.id === bookId))
  if (!books.length) return null
  return (
    <>
      <p className="group-title">{books.length === 1 ? 'Your copy of the book' : 'Your copies of books'}</p>
      {books.map((b) => (
        <YourCopyRow key={b.id} bookId={b.id} showTitle={books.length > 1} />
      ))}
    </>
  )
}

function YourCopyRow({ bookId, showTitle }: { bookId: string; showTitle: boolean }) {
  const meta = library.find((b) => b.id === bookId)!
  const copy = useCopy(bookId)
  const title = meta.shortTitle ?? meta.title
  return (
    <>
      <a
        className="row"
        href={href('b', bookId, 'text')}
        onClick={(e) => {
          e.preventDefault()
          leaveSheetTo(href('b', bookId, 'text'))
        }}
      >
        <span className="row__body">
          <span className="row__title">{showTitle ? title : copy.status === 'ready' ? copy.info.file.name : 'Add your copy'}</span>
          <span className="row__sub">
            {copy.status === 'ready' ? `${showTitle ? copy.info.file.name + ' · ' : ''}Read it here, or remove it from this device` : showTitle ? 'Add your copy: EPUB, PDF or text. It stays on this device.' : 'EPUB, PDF or text. It stays on this device.'}
          </span>
        </span>
        <Icon name="chevronRight" className="icon--sm chev" />
      </a>
    </>
  )
}
