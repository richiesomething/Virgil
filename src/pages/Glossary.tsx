import { useMemo, useState } from 'react'
import type { NoteKind } from '../types'
import Icon from '../components/Icon'
import { kindLabel } from '../components/Sheets'
import { Segmented } from '../components/ui'
import { useBook } from '../lib/book-context'
import { navigate, useLocation, withQuery, href } from '../lib/router'
import { notesUpTo } from '../lib/spoilers'
import { fold } from '../lib/search'

type View = 'az' | 'chapter'
const kindOrder: NoteKind[] = ['word', 'money', 'history', 'title', 'place', 'custom', 'reference', 'foreign', 'lore']

export default function Glossary() {
  const { book, upTo, openNote } = useBook()
  const loc = useLocation()
  const [q, setQ] = useState('')
  const [view, setView] = useState<View>('az')
  const kind = (loc.query.get('kind') as NoteKind | null) ?? null
  const all = notesUpTo(book, upTo)
  const counts = useMemo(() => {
    const m = new Map<NoteKind, number>()
    for (const n of all) m.set(n.kind, (m.get(n.kind) ?? 0) + 1)
    return m
  }, [all])

  const fq = fold(q.trim())
  const shown = all.filter((n) => (!kind || n.kind === kind) && (!fq || fold(n.term).includes(fq) || fold(n.text).includes(fq)))
  const setKind = (k: NoteKind | null) => navigate(withQuery(href('b', book.meta.id, 'glossary'), { kind: k ?? undefined }), { replace: true })

  const groups = useMemo(() => {
    if (view === 'chapter') {
      const m = new Map<number, typeof shown>()
      for (const n of shown) m.set(n.chapter, [...(m.get(n.chapter) ?? []), n])
      return [...m.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([c, list]) => ({ key: String(c), title: `Chapter ${c}${book.chapters[c - 1]?.title ? ' · ' + book.chapters[c - 1].title : ''}`, list }))
    }
    const m = new Map<string, typeof shown>()
    const sorted = [...shown].sort((a, b) => fold(stripArticle(a.term)).localeCompare(fold(stripArticle(b.term))))
    for (const n of sorted) {
      const letter = fold(stripArticle(n.term))[0]?.toUpperCase() ?? '#'
      const key = /[A-Z]/.test(letter) ? letter : '#'
      m.set(key, [...(m.get(key) ?? []), n])
    }
    return [...m.entries()].map(([k, list]) => ({ key: k, title: k, list }))
  }, [shown, view, book])

  if (upTo === 0 || all.length === 0) {
    return (
      <div>
        <h1 className="large-title">Glossary</h1>
        <div className="empty">
          <p>Terms you’ll want explained appear here as you read.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="large-title">Glossary</h1>
      <p className="muted" style={{ marginBottom: 4 }}>
        {all.length} terms through chapter {upTo}
      </p>
      <div className="sticky-sub" style={{ paddingBottom: 4 }}>
        <label className="field">
          <Icon name="search" className="icon--sm" />
          <input type="search" placeholder="Search terms" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search the glossary" enterKeyHint="search" />
        </label>
        <div className="chips" style={{ marginTop: 6 }}>
          <button className="chip-btn" aria-pressed={!kind} onClick={() => setKind(null)}>
            All {all.length}
          </button>
          {kindOrder
            .filter((k) => counts.get(k))
            .map((k) => (
              <button key={k} className="chip-btn" aria-pressed={kind === k} onClick={() => setKind(kind === k ? null : k)}>
                {kindLabel[k]} {counts.get(k)}
              </button>
            ))}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '6px 0 4px' }}>
        <div style={{ width: 200 }}>
          <Segmented<View>
            label="Order"
            value={view}
            onChange={setView}
            options={[
              { value: 'az', label: 'A–Z' },
              { value: 'chapter', label: 'By chapter' },
            ]}
          />
        </div>
      </div>

      {shown.length === 0 && (
        <div className="empty">
          <p>{kind ? `No ${kindLabel[kind].toLowerCase()} terms` : 'No terms'} match in what you’ve read.</p>
          {(kind || q) && (
            <button className="btn btn--secondary" onClick={() => (setQ(''), setKind(null))}>
              Clear filters
            </button>
          )}
        </div>
      )}

      {groups.map((g) => (
        <section key={g.key}>
          <h2 className="letter-head">{g.title}</h2>
          <div className="group">
            {g.list.map((n) => (
              <button key={n.id} className="row gl-row" onClick={() => openNote(n.id)}>
                <span className="row__body">
                  <span className="row__title">{n.term}</span>
                  <span className="row__sub clamp-1">{n.text}</span>
                </span>
                <span className="row__meta" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <span className="tag">{kindLabel[n.kind]}</span>
                  {view === 'az' && <span>ch {n.chapter}</span>}
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

/** Sort key: ignore leading quotes/punctuation and articles ("the 'Sesame' of Ali Baba" files under S). */
const stripArticle = (s: string) =>
  s
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .replace(/^(the|a|an|le|la|les|l’|l')\s+/i, '')
    .replace(/^[^\p{L}\p{N}]+/u, '')
