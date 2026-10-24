import { forwardRef, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { BookData } from '../types'
import Icon from './Icon'
import { initials } from './CharacterChip'
import { search, fold, type SearchHit } from '../lib/search'
import { href } from '../lib/router'
import { recents } from '../lib/store'
import { kindOf, metCharacters, notesUpTo, whoMattersNow } from '../lib/spoilers'
import { leaveSheetTo } from './ui'

interface Props {
  open: boolean
  onClose: () => void
  book: BookData
  upTo: number
  onNote: (id: string) => void
}

type Group = 'chapter' | 'character' | 'thing' | 'note'
const groupTitle: Record<Group, string> = { chapter: 'Chapters', character: 'People', thing: 'Objects & places', note: 'Glossary' }

/**
 * Full-screen lookup. The input stays mounted so it can be focused inside the
 * tap that opens it — the only way iOS Safari will show the keyboard.
 */
const SearchOverlay = forwardRef<HTMLInputElement, Props>(function SearchOverlay({ open, onClose, book, upTo, onNote }, inputRef) {
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [expanded, setExpanded] = useState<Set<Group>>(new Set())
  const [active, setActive] = useState(0)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const allRecents = recents.use()
  const bookId = book.meta.id
  const myRecents = allRecents[bookId] ?? []

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 80)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    if (!open) return
    history.pushState({ overlay: 'search' }, '')
    const onPop = () => onCloseRef.current()
    window.addEventListener('popstate', onPop)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('popstate', onPop)
      document.body.style.overflow = ''
    }
  }, [open])
  useEffect(() => {
    if (!open) ((setQ(''), setDebounced('')), setExpanded(new Set()))
  }, [open])

  const hits = useMemo(() => search(book, upTo, debounced), [book, upTo, debounced])
  const grouped = useMemo(() => {
    const g = new Map<Group, SearchHit[]>()
    for (const h of hits) g.set(h.kind, [...(g.get(h.kind) ?? []), h])
    return (['chapter', 'character', 'thing', 'note'] as Group[]).filter((k) => g.has(k)).map((k) => [k, g.get(k)!] as const)
  }, [hits])
  const visible = grouped.flatMap(([k, list]) => (expanded.has(k) ? list : list.slice(0, 3)))

  const remember = (kind: string, id: string, label: string) =>
    recents.set((all) => ({
      ...all,
      [bookId]: [{ kind, id, label }, ...(all[bookId] ?? []).filter((r) => !(r.kind === kind && r.id === id))].slice(0, 8),
    }))

  const openHit = (h: SearchHit) => {
    if (h.kind === 'note') {
      remember('note', h.note.id, h.note.term)
      history.back()
      setTimeout(() => onNote(h.note.id), 0)
      return
    }
    if (h.kind === 'chapter') {
      remember('chapter', String(h.chapter.number), `Chapter ${h.chapter.number}${h.chapter.title ? ' · ' + h.chapter.title : ''}`)
      onClose()
      leaveSheetTo(href('b', bookId, 'chapters', h.chapter.number))
      return
    }
    remember('character', h.character.id, h.character.name)
    onClose()
    leaveSheetTo(href('b', bookId, 'characters', h.character.id))
  }

  const openRecent = (r: { kind: string; id: string }) => {
    if (r.kind === 'note') {
      if (!notesUpTo(book, upTo).some((n) => n.id === r.id)) return
      history.back()
      setTimeout(() => onNote(r.id), 0)
    } else if (r.kind === 'chapter') {
      onClose()
      leaveSheetTo(href('b', bookId, 'chapters', r.id))
    } else {
      onClose()
      leaveSheetTo(href('b', bookId, 'characters', r.id))
    }
  }
  // Recents are only shown while still within the bookmark (a reader may have moved back).
  const safeRecents = myRecents.filter((r) =>
    r.kind === 'chapter'
      ? Number(r.id) <= upTo
      : r.kind === 'note'
        ? notesUpTo(book, upTo).some((n) => n.id === r.id)
        : metCharacters(book, upTo).some((c) => c.id === r.id),
  )

  const examples = useMemo(() => {
    const out: string[] = []
    const who = whoMattersNow(book, upTo, 1)[0]
    if (who) out.push(who.name)
    const note = notesUpTo(book, upTo).slice(-1)[0]
    if (note) out.push(note.term)
    if (upTo > 0) out.push(String(upTo))
    return out
  }, [book, upTo])

  const fq = fold(debounced.trim())
  const highlight = (text: string): ReactNode => {
    if (!fq) return text
    const i = fold(text).indexOf(fq)
    if (i < 0) return text
    return (
      <>
        {text.slice(0, i)}
        <mark>{text.slice(i, i + fq.length)}</mark>
        {text.slice(i + fq.length)}
      </>
    )
  }

  let index = -1
  return (
    <div className="search" aria-hidden={!open} style={open ? undefined : { opacity: 0, pointerEvents: 'none', transform: 'translateY(-100%)' }}>
      <div className="search__bar">
        <label className="field">
          <Icon name="search" className="icon--sm" />
          <input
            ref={inputRef}
            type="search"
            enterKeyHint="search"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Names, places, words, chapters"
            value={q}
            onChange={(e) => (setQ(e.target.value), setActive(0))}
            role="combobox"
            aria-expanded={visible.length > 0}
            aria-controls="search-results"
            aria-activedescendant={visible.length ? `sr-${active}` : undefined}
            tabIndex={open ? 0 : -1}
            onKeyDown={(e) => {
              if (e.key === 'Escape') history.back()
              if (e.key === 'ArrowDown') (e.preventDefault(), setActive((a) => Math.min(a + 1, visible.length - 1)))
              if (e.key === 'ArrowUp') (e.preventDefault(), setActive((a) => Math.max(a - 1, 0)))
              if (e.key === 'Enter' && visible[active]) openHit(visible[active])
            }}
          />
          {q && (
            <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => setQ('')} aria-label="Clear search">
              <Icon name="x" className="icon--sm" />
            </button>
          )}
        </label>
        <button className="link" onClick={() => history.back()} tabIndex={open ? 0 : -1}>
          Cancel
        </button>
      </div>

      <div className="search__body" onTouchMove={() => (document.activeElement as HTMLElement)?.blur?.()}>
        <div className="search__inner" id="search-results" role="listbox">
          {!fq && safeRecents.length > 0 && (
            <>
              <div className="section-head" style={{ marginTop: 16 }}>
                <p className="group-title" style={{ margin: 0 }}>Recent</p>
                <button className="link" onClick={() => recents.set((all) => ({ ...all, [bookId]: [] }))}>
                  Clear
                </button>
              </div>
              <div className="group">
                {safeRecents.map((r) => (
                  <div key={r.kind + r.id} className="row" style={{ paddingRight: 4 }}>
                    <button className="row__body" style={{ background: 'none', border: 0, textAlign: 'left', cursor: 'pointer', padding: 0, font: 'inherit', color: 'inherit' }} onClick={() => openRecent(r)}>
                      <span className="row__title">{r.label}</span>
                    </button>
                    <button
                      className="icon-btn"
                      aria-label={`Remove ${r.label}`}
                      onClick={() => recents.set((all) => ({ ...all, [bookId]: (all[bookId] ?? []).filter((x) => !(x.kind === r.kind && x.id === r.id)) }))}
                    >
                      <Icon name="x" className="icon--sm" />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
          {!fq && safeRecents.length === 0 && (
            <div className="empty" style={{ paddingTop: 32 }}>
              <p>Try a name, a nickname, a word from the book, or a chapter number.</p>
              <div className="chips" style={{ justifyContent: 'center', margin: 0 }}>
                {examples.map((x) => (
                  <button key={x} className="chip-btn" onClick={() => setQ(x)}>
                    {x}
                  </button>
                ))}
              </div>
            </div>
          )}
          {fq && hits.length === 0 && debounced === q && (
            <div className="empty">
              <p>No matches in what you’ve read so far.</p>
            </div>
          )}
          {grouped.map(([kind, list]) => (
            <section key={kind}>
              <p className="group-title">{groupTitle[kind]}</p>
              <div className="group">
                {(expanded.has(kind) ? list : list.slice(0, 3)).map((h) => {
                  index++
                  const i = index
                  return (
                    <ResultRow key={key(h)} id={`sr-${i}`} active={i === active} hit={h} highlight={highlight} onOpen={() => openHit(h)} />
                  )
                })}
                {list.length > 3 && !expanded.has(kind) && (
                  <button className="row" onClick={() => setExpanded(new Set([...expanded, kind]))}>
                    <span className="row__body">
                      <span className="link" style={{ minHeight: 0 }}>
                        Show all {list.length} {groupTitle[kind].toLowerCase()}
                      </span>
                    </span>
                  </button>
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
})

export default SearchOverlay

function key(h: SearchHit) {
  return h.kind === 'note' ? 'n' + h.note.id : h.kind === 'chapter' ? 'c' + h.chapter.number : 'p' + h.character.id
}

function ResultRow({ hit, id, active, highlight, onOpen }: { hit: SearchHit; id: string; active: boolean; highlight: (s: string) => ReactNode; onOpen: () => void }) {
  if (hit.kind === 'chapter') {
    const c = hit.chapter
    return (
      <button id={id} role="option" aria-selected={active} className="row" onClick={onOpen}>
        <span className="ch-row__num">{c.number}</span>
        <span className="row__body">
          <span className="row__title">{highlight(c.title || `Chapter ${c.number}`)}</span>
          <span className="row__sub clamp-1">{c.summary}</span>
        </span>
      </button>
    )
  }
  if (hit.kind === 'note') {
    const n = hit.note
    return (
      <button id={id} role="option" aria-selected={active} className="row" onClick={onOpen}>
        <span className="row__body">
          <span className="row__title">{highlight(n.term)}</span>
          <span className="row__sub clamp-1">{n.text}</span>
        </span>
        <span className="tag">{n.kind}</span>
      </button>
    )
  }
  const c = hit.character
  const viaAlias = hit.matched !== c.name
  return (
    <button id={id} role="option" aria-selected={active} className="row row--avatar" onClick={onOpen}>
      <span className={`avatar avatar--sm avatar--${c.importance} avatar--${kindOf(c)}`} aria-hidden="true">
        {initials(c.name)}
      </span>
      <span className="row__body">
        <span className="row__title">{viaAlias ? c.name : highlight(c.name)}</span>
        <span className="row__sub clamp-1">{viaAlias ? <>also known as {highlight(hit.matched)}</> : hit.detail}</span>
      </span>
    </button>
  )
}
