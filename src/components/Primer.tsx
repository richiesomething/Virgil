import { useState } from 'react'
import type { BookData } from '../types'
import Icon from './Icon'
import { initials } from './CharacterChip'
import { showToast } from './ui'
import { href } from '../lib/router'
import { prefs } from '../lib/store'
import { lookupCharacter, primerFor } from '../lib/spoilers'
import { bestFrame, upcomingSetting } from '../lib/atlas'
import { atlasHref } from './AtlasView'

// Remember, per book, whether the reader last left the primer open.
const openState = new Map<string, boolean>()

/** "Before you read" for chapter n (only ever bookmark + 1). Renders nothing when primers are off. */
export default function Primer({ book, n, upTo, forceOpen }: { book: BookData; n: number; upTo: number; forceOpen?: boolean }) {
  const p = prefs.use()
  const id = book.meta.id
  const primer = primerFor(book, n, upTo)
  const mode = p.primersHidden.includes(id) ? 'off' : p.primers
  const [open, setOpen] = useState(() => forceOpen || (openState.get(id) ?? mode === 'expanded'))
  if (!primer || mode === 'off') return null

  // Returning characters are described as the reader knows them now.
  const returning = primer.returning
    .map((r) => ({ ...r, look: lookupCharacter(book, r.id, upTo) }))
    .filter((r) => r.look.status !== 'hidden')
  const wherePlace = upcomingSetting(book, n, upTo)
  const whereFrame = wherePlace && bestFrame(book, wherePlace, upTo)
  const where = wherePlace && whereFrame ? { place: wherePlace, frame: whereFrame } : undefined
  const count = (primer.setting ? 1 : 0) + (primer.keepInMind ? 1 : 0) + returning.length
  const toggle = () => {
    openState.set(id, !open)
    setOpen(!open)
  }
  const hide = () => {
    prefs.set((x) => ({ ...x, primersHidden: [...new Set([...x.primersHidden, id])] }))
    showToast('Primers hidden for this book.', {
      label: 'Undo',
      run: () => prefs.set((x) => ({ ...x, primersHidden: x.primersHidden.filter((b) => b !== id) })),
    })
  }

  return (
    <div className="primer" data-open={open}>
      <button className="primer__toggle" onClick={toggle} aria-expanded={open}>
        <Icon name="sparkle" className="icon--sm" />
        Before you read
        <span className="small muted" style={{ marginLeft: 'auto', fontWeight: 500 }}>
          {count} note{count === 1 ? '' : 's'}
        </span>
        <Icon name="chevronDown" className="icon--sm chev" />
      </button>
      {open && (
        <div className="primer__body">
          {primer.setting && (
            <div className="primer__item">
              <span className="primer__label">Setting</span>
              <span>
                {primer.setting}
                {where && (
                  <a className="primer__map" href={atlasHref(id, { place: where.place.id, frame: where.frame.id })}>
                    <Icon name="pin" className="icon--sm" /> {where.place.name} on the map
                  </a>
                )}
              </span>
            </div>
          )}
          {primer.keepInMind && (
            <div className="primer__item">
              <span className="primer__label">Keep in mind</span>
              <span>{primer.keepInMind}</span>
            </div>
          )}
          {returning.length > 0 && (
            <div className="primer__item">
              <span className="primer__label">Returning</span>
              <div className="primer__returning">
                {returning.map((r) => {
                  const cid = r.look.status === 'merged' ? r.look.into : r.id
                  const c = book.characters.find((x) => x.id === cid)!
                  return (
                    <a key={r.id} href={href('b', id, 'characters', cid)}>
                      <span className={`avatar avatar--sm avatar--${c.importance}`} aria-hidden="true">
                        {initials(c.name)}
                      </span>
                      <span>
                        <strong>{c.name}</strong>
                        <br />
                        <span className="small muted">{r.reminder}</span>
                      </span>
                    </a>
                  )
                })}
              </div>
            </div>
          )}
          <button className="primer__hide" onClick={hide}>
            Hide primers for this book
          </button>
        </div>
      )}
    </div>
  )
}
