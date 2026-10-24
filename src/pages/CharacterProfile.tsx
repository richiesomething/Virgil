import type { BookPageProps } from './BookShell'
import { href } from '../lib/router'
import { characterView, lookupCharacter } from '../lib/spoilers'
import { initials } from '../components/CharacterChip'

const importanceLabel = { major: 'Major character', supporting: 'Supporting character', minor: 'Minor character' }

export default function CharacterProfile({ book, upTo, id }: BookPageProps & { id: string }) {
  const { meta } = book
  const found = lookupCharacter(book, id, upTo)

  if (found.status === 'hidden') {
    return (
      <div className="empty">
        <h1>You haven’t met this character yet</h1>
        <p>Keep reading. Their profile appears once they show up in the story.</p>
        <a className="btn btn--ghost" href={href('b', meta.id, 'characters')}>All characters</a>
      </div>
    )
  }

  if (found.status === 'merged') {
    const target = book.characters.find((c) => c.id === found.into)
    return (
      <div className="empty">
        <h1>A familiar face</h1>
        <p>By this point in the book you know who this really is.</p>
        <a className="btn" href={href('b', meta.id, 'characters', found.into)}>
          Go to {target?.name ?? 'their profile'}
        </a>
      </div>
    )
  }

  const v = characterView(book, found.character, upTo)
  const c = v.character

  return (
    <article className="profile">
      <a className="back" href={href('b', meta.id, 'characters')}>← All characters</a>

      <header className="profile__head">
        <span className={`avatar avatar--lg avatar--${c.importance}`} aria-hidden="true">{initials(c.name)}</span>
        <div>
          <h1 className="page-title">{c.name}</h1>
          {v.tagline && <p className="lede">{v.tagline}</p>}
          <p className="small muted">
            {importanceLabel[c.importance]} · {c.group} · First appears in{' '}
            <a href={href('b', meta.id, 'chapters', c.firstChapter)}>chapter {c.firstChapter}</a>
          </p>
        </div>
      </header>

      {v.aliases.length > 0 && (
        <section className="card">
          <p className="eyebrow">Also known as</p>
          <ul className="aliases">
            {v.aliases.map((a) => (
              <li key={a.name + a.from}>
                <strong>{a.name}</strong>
                {a.note && <span className="muted"> · {a.note}</span>}
                <span className="small muted"> (ch. {a.from})</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {v.description.length > 0 && (
        <section className="prose">
          <h2 className="section-title">Profile</h2>
          {v.description.map((d, i) => (
            <p key={i}>
              {d.text}
              {d.from > c.firstChapter && <span className="since"> ch. {d.from}</span>}
            </p>
          ))}
        </section>
      )}

      {v.moments.length > 0 && (
        <section>
          <h2 className="section-title">Key moments so far</h2>
          <ol className="timeline">
            {v.moments.map((m, i) => (
              <li key={i}>
                <a className="timeline__ch" href={href('b', meta.id, 'chapters', m.chapter)}>Ch. {m.chapter}</a>
                <span>{m.text}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {v.appearances.length > 0 && (
        <section>
          <h2 className="section-title">Appears in {v.appearances.length} chapter{v.appearances.length === 1 ? '' : 's'}</h2>
          <div className="ch-pills">
            {v.appearances.map((n) => (
              <a key={n} className="ch-pill" href={href('b', meta.id, 'chapters', n)}>{n}</a>
            ))}
          </div>
        </section>
      )}

      <p className="small muted footnote">
        Showing what you know through chapter {upTo}. This profile fills in as you read.
      </p>
    </article>
  )
}
