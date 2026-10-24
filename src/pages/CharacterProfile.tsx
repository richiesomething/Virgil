import Icon from '../components/Icon'
import { initials } from '../components/CharacterChip'
import { useBook } from '../lib/book-context'
import { href } from '../lib/router'
import { characterView, connectionsOf, kindOf, kinRole, lookupCharacter } from '../lib/spoilers'
import { kinLabel, relationLabel, relationTypes } from '../lib/relations'

const importanceLabel = { major: 'Major', supporting: 'Supporting', minor: 'Minor' }
const kindNoun = { character: 'character', object: 'object', place: 'place' }

export default function CharacterProfile({ id }: { id: string }) {
  const { book, upTo } = useBook()
  const { meta } = book
  const found = lookupCharacter(book, id, upTo)

  if (found.status === 'hidden') {
    return (
      <div className="empty">
        <h1>You haven’t come across this yet</h1>
        <p>Keep reading. The profile appears once it shows up in the story.</p>
        <a className="btn btn--secondary" href={href('b', meta.id, 'cast')}>
          Back to the cast
        </a>
      </div>
    )
  }
  if (found.status === 'merged') {
    const target = book.characters.find((c) => c.id === found.into)
    return (
      <div className="empty">
        <h1>A familiar face</h1>
        <p>By this point in the book you know who this really is.</p>
        <a className="btn btn--primary" href={href('b', meta.id, 'characters', found.into)}>
          Go to {target?.name ?? 'their profile'}
        </a>
      </div>
    )
  }

  const v = characterView(book, found.character, upTo)
  const c = v.character
  const kind = kindOf(c)
  const byId = new Map(book.characters.map((x) => [x.id, x]))
  const rels = connectionsOf(book, c.id, upTo).sort(
    (p, q) => relationTypes.findIndex((r) => r.type === p.type) - relationTypes.findIndex((r) => r.type === q.type),
  )
  const moments = v.moments
  const recentMoments = moments.slice(-5)

  return (
    <article>
      <header className="profile-head">
        <span className={`avatar avatar--lg avatar--${c.importance} avatar--${kind}`} aria-hidden="true">
          {initials(c.name)}
        </span>
        <div style={{ minWidth: 0 }}>
          <h1>{c.name}</h1>
          {v.tagline && <p className="tagline">{v.tagline}</p>}
        </div>
      </header>
      <p className="meta-line">
        {importanceLabel[c.importance]} {kindNoun[kind]}
        {kind === 'character' && ` · ${c.group}`} · First appears in{' '}
        <a href={href('b', meta.id, 'chapters', c.firstChapter)}>chapter {c.firstChapter}</a>
      </p>

      {v.description.length > 0 && (
        <details className="section" open>
          <summary>
            About <Icon name="chevronDown" className="icon--sm chev" />
          </summary>
          <div className="section__body prose">
            {v.description.map((d, i) => (
              <p key={i}>
                {d.text}
                {d.from > c.firstChapter && <span className="since">ch. {d.from}</span>}
              </p>
            ))}
          </div>
        </details>
      )}

      {v.aliases.length > 0 && (
        <details className="section" open={v.aliases.length <= 3}>
          <summary>
            Also known as <Icon name="chevronDown" className="icon--sm chev" />
          </summary>
          <ul className="section__body" style={{ margin: 0, paddingLeft: 18 }}>
            {v.aliases.map((a) => (
              <li key={a.name + a.from} style={{ marginBottom: 4 }}>
                <strong>{a.name}</strong>
                {a.note && <span className="muted"> · {a.note}</span>}
                <span className="small muted"> (ch. {a.from})</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {rels.length > 0 && (
        <details className="section" open>
          <summary>
            Connections · {rels.length} <Icon name="chevronDown" className="icon--sm chev" />
          </summary>
          <div className="section__body">
            <ul className="rel-list">
              {rels.map((l) => {
                const other = byId.get(l.a === c.id ? l.b : l.a)!
                const role = kinRole(l, other.id)
                return (
                  <li key={other.id}>
                    <a href={href('b', meta.id, 'characters', other.id)}>
                      <svg width="20" height="10" aria-hidden="true">
                        <line x1="1" y1="5" x2="19" y2="5" className={`rel rel--${l.type}`} strokeDasharray={relationTypes.find((r) => r.type === l.type)?.dash} />
                      </svg>
                      <span>
                        <span className="who">{other.name}</span>
                        <span className="small muted"> · {role ? kinLabel[role] : relationLabel[l.type]}</span>
                        <br />
                        <span className="small">{l.label}</span>
                      </span>
                    </a>
                  </li>
                )
              })}
            </ul>
            <a className="link" href={href('b', meta.id, 'map', c.id)}>
              See on the map <Icon name="chevronRight" className="icon--sm" />
            </a>
          </div>
        </details>
      )}

      {moments.length > 0 && (
        <details className="section" open={moments.length <= 5}>
          <summary>
            Moments · {moments.length} <Icon name="chevronDown" className="icon--sm chev" />
          </summary>
          <div className="section__body">
            <Moments all={moments} recent={recentMoments} bookId={meta.id} />
          </div>
        </details>
      )}

      {v.appearances.length > 0 && (
        <details className="section">
          <summary>
            Appears in {v.appearances.length} chapter{v.appearances.length === 1 ? '' : 's'} <Icon name="chevronDown" className="icon--sm chev" />
          </summary>
          <div className="section__body ch-pills">
            {v.appearances.map((n) => (
              <a key={n} className="ch-pill" href={href('b', meta.id, 'chapters', n)}>
                {n}
              </a>
            ))}
          </div>
        </details>
      )}

      <p className="small muted" style={{ marginTop: 24 }}>
        Showing what you know through chapter {upTo}. This profile fills in as you read.
      </p>
    </article>
  )
}

function Moments({ all, recent, bookId }: { all: { chapter: number; text: string }[]; recent: typeof all; bookId: string }) {
  const list = all.length > 5 ? all : recent
  return (
    <ol className="timeline">
      {list.map((m, i) => (
        <li key={i}>
          <a className="timeline__ch" href={href('b', bookId, 'chapters', m.chapter)}>
            Ch. {m.chapter}
          </a>
          <span>{m.text}</span>
        </li>
      ))}
    </ol>
  )
}
