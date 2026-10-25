import { useEffect, useRef, useState } from 'react'
import Icon from '../components/Icon'
import { showToast } from '../components/ui'
import { useBook } from '../lib/book-context'
import { href, navigate } from '../lib/router'
import { deleteCopy, putCopy, useCopy } from '../lib/copies'
import { forgetText } from '../lib/text'
import { detectChapters, looksLikeHeading, splitChapters, wordCount, type Detection, type Para } from '../lib/import/chapters'
import { parseFile } from '../lib/import/parse'

type Step =
  | { kind: 'idle' }
  | { kind: 'parsing'; message: string; fraction?: number }
  | { kind: 'review'; file: File; paragraphs: Para[]; detection: Detection; starts: number[] }
  | { kind: 'saving' }

/** Import the reader's own copy of a copyrighted book, parsed and kept on this device. */
export default function YourCopy() {
  const { book, upTo } = useBook()
  const id = book.meta.id
  const total = book.meta.chapterCount
  const copy = useCopy(id)
  const [step, setStep] = useState<Step>({ kind: 'idle' })
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const titles = book.chapters.map((c) => c.title)

  if (book.meta.text?.status === 'shipped') {
    return (
      <div className="empty">
        <h1>This book’s text is built in</h1>
        <p>{book.meta.text.edition}. Nothing to add.</p>
        <a className="btn btn--primary" href={href('b', id, 'read', Math.min(total, upTo + 1))}>
          Read it
        </a>
      </div>
    )
  }

  const onFile = async (file: File) => {
    setError(null)
    setStep({ kind: 'parsing', message: 'Opening the file…' })
    try {
      const paragraphs = await parseFile(file, (message, fraction) => setStep({ kind: 'parsing', message, fraction }))
      if (paragraphs.length < 10) throw new Error('Virgil couldn’t find any text in that file.')
      const detection = detectChapters(paragraphs, titles, total)
      setStep({ kind: 'review', file, paragraphs, detection, starts: detection.starts })
    } catch (e) {
      setError((e as Error).message)
      setStep({ kind: 'idle' })
    }
  }

  const save = async (s: Extract<Step, { kind: 'review' }>) => {
    setStep({ kind: 'saving' })
    try {
      const chapters = splitChapters(s.paragraphs, s.starts, titles)
      await putCopy({
        bookId: id,
        file: { name: s.file.name, size: s.file.size, type: s.file.type },
        importedAt: new Date().toISOString(),
        chapters,
        wordCounts: chapters.map(wordCount),
      })
      forgetText(id)
      showToast('Your copy is ready to read.')
      navigate(href('b', id, 'read', Math.min(total, upTo + 1)), { replace: true })
    } catch (e) {
      setError(`Couldn’t save it: ${(e as Error).message}`)
      setStep({ kind: 'idle' })
    }
  }

  if (step.kind === 'review') return <Review step={step} total={total} upTo={upTo} titles={titles} onChange={(starts) => setStep({ ...step, starts })} onSave={() => save(step)} onCancel={() => setStep({ kind: 'idle' })} />

  return (
    <article className="stack">
      <div>
        <h1 className="page-title">Your copy of the book</h1>
        <p className="lede">
          <em>{book.meta.title}</em> is still in copyright, so Virgil can’t include its text. Add your own copy and read it here, one word at a time, with your place tied to your bookmark.
        </p>
      </div>

      {copy.status === 'ready' && (
        <div className="card">
          <p className="group-title">On this device</p>
          <p style={{ margin: '0 0 4px' }}>
            <strong>{copy.info.file.name}</strong>
          </p>
          <p className="muted small" style={{ margin: 0 }}>
            Added {new Date(copy.info.importedAt).toLocaleDateString()} · {copy.info.wordCounts.length} chapters · {copy.info.wordCounts.reduce((a, b) => a + b, 0).toLocaleString()} words
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <a className="btn btn--primary" href={href('b', id, 'read', Math.min(total, upTo + 1))} style={{ flex: 1 }}>
              <Icon name="play" /> Read
            </a>
            <button
              className="btn btn--ghost"
              onClick={async () => {
                try {
                  await deleteCopy(id)
                  forgetText(id)
                  showToast('Your copy was removed from this device.')
                } catch (e) {
                  setError(`Couldn’t remove it: ${(e as Error).message}`)
                }
              }}
            >
              Remove
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <p className="group-title">{copy.status === 'ready' ? 'Replace it' : 'Add a file'}</p>
        <p className="muted" style={{ marginTop: 0 }}>
          EPUB works best. PDF and plain text work too. Virgil matches the file’s chapters to its own {total} chapters, so use an edition with the same chapters: {book.meta.edition}.
        </p>
        <input
          ref={input}
          type="file"
          accept=".epub,.pdf,.txt,.md,application/epub+zip,application/pdf,text/plain"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onFile(f)
            e.target.value = ''
          }}
        />
        {step.kind === 'parsing' || step.kind === 'saving' ? (
          <div className="import-progress" role="status">
            <span className="muted">{step.kind === 'saving' ? 'Saving…' : step.message}</span>
            {step.kind === 'parsing' && step.fraction !== undefined && <progress value={step.fraction} max={1} style={{ width: '100%' }} />}
          </div>
        ) : (
          <button className="btn btn--primary btn--block" onClick={() => input.current?.click()}>
            <Icon name="upload" /> Choose a file
          </button>
        )}
        {error && (
          <p className="import-error" role="alert">
            {error}
          </p>
        )}
        <p className="small muted" style={{ margin: '12px 0 0' }}>
          Your file is read on this device and kept in this browser. It is never uploaded.
        </p>
      </div>
    </article>
  )
}

function Review({
  step,
  total,
  upTo,
  titles,
  onChange,
  onSave,
  onCancel,
}: {
  step: Extract<Step, { kind: 'review' }>
  total: number
  upTo: number
  titles: string[]
  onChange: (starts: number[]) => void
  onSave: () => void
  onCancel: () => void
}) {
  const { paragraphs, detection, starts } = step
  const ok = starts.length === total
  const [manual, setManual] = useState(detection.method === 'none')
  const chapters = ok ? splitChapters(paragraphs, starts, titles) : []
  useEffect(() => window.scrollTo(0, 0), [])

  return (
    <article className="stack">
      <div>
        <h1 className="page-title">Check the chapters</h1>
        <p className="lede">
          {detection.method === 'titles' && `Virgil found all ${total} chapters by their titles.`}
          {detection.method === 'numbered' && `Virgil found ${total} numbered chapters.`}
          {detection.method === 'none' && `Virgil couldn’t line the file up with ${total} chapters on its own. Tick the line where each chapter starts.`}
        </p>
      </div>

      {ok && !manual && (
        <div className="group">
          {chapters.map((ch, i) => {
            const n = i + 1
            const words = wordCount(ch)
            const open = n <= upTo + 1
            return (
              <div key={n} className="row">
                <span className="ch-row__num">{n}</span>
                <span className="row__body">
                  <span className="row__title">
                    Chapter {n} <span className="muted small">· {words.toLocaleString()} words</span>
                  </span>
                  {open ? <span className="row__sub clamp-1">{ch[0]}</span> : <span className="row__sub muted">Still ahead of you</span>}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {manual && <Candidates paragraphs={paragraphs} candidates={detection.candidates} starts={starts} total={total} upTo={upTo} onChange={onChange} />}

      <div className="action-bar" style={{ position: 'static', background: 'none', border: 0, padding: 0 }}>
        <div style={{ display: 'grid', gap: 10 }}>
          <button className="btn btn--primary btn--lg btn--block" disabled={!ok} onClick={onSave}>
            <Icon name="check" /> {ok ? `Use these ${total} chapters` : `${starts.length} of ${total} chapters marked`}
          </button>
          {!manual && (
            <button className="btn btn--secondary btn--block" onClick={() => setManual(true)}>
              Fix the chapters by hand
            </button>
          )}
          <button className="btn btn--ghost btn--block" onClick={onCancel}>
            Choose another file
          </button>
        </div>
      </div>
    </article>
  )
}

/** Every heading-like line in the file, to tick the chapter starts. */
function Candidates({
  paragraphs,
  candidates,
  starts,
  total,
  upTo,
  onChange,
}: {
  paragraphs: Para[]
  candidates: number[]
  starts: number[]
  total: number
  upTo: number
  onChange: (starts: number[]) => void
}) {
  const [showAll, setShowAll] = useState(false)
  const list = showAll ? paragraphs.map((_, i) => i).filter((i) => looksLikeHeading(paragraphs[i]) || paragraphs[i].text.length < 120) : candidates
  const chosen = new Set(starts)
  const toggle = (i: number) => {
    const next = chosen.has(i) ? starts.filter((s) => s !== i) : [...starts, i].sort((a, b) => a - b)
    onChange(next)
  }
  // Lines that could be a later chapter's heading are blurred: by how many starts are ticked before
  // them, and, while few are ticked, by their position in the list (allowing a few front-matter lines).
  const safeCount = Math.min(total, upTo + 1)
  return (
    <div className="stack" style={{ gap: 10 }}>
      <p className="muted small" style={{ margin: 0 }}>
        {starts.length} of {total} ticked. Chapter titles after your bookmark are blurred; tap one to see it.
      </p>
      <div className="group">
        {list.map((i) => {
          const rank = starts.filter((s) => s < i).length + 1
          const hidden = rank > safeCount || (starts.length < safeCount && list.indexOf(i) >= safeCount + 3)
          return (
            <label key={i} className="row candidate">
              <input type="checkbox" checked={chosen.has(i)} onChange={() => toggle(i)} />
              <span className="row__body">
                <span className={`row__title${hidden ? ' is-blurred' : ''}`} onClick={(e) => (e.currentTarget.classList.remove('is-blurred'), e.preventDefault())}>
                  {paragraphs[i].text}
                </span>
                {chosen.has(i) && <span className="row__sub">Chapter {rank}</span>}
              </span>
            </label>
          )
        })}
      </div>
      {!showAll && (
        <button className="link" onClick={() => setShowAll(true)}>
          Show more lines
        </button>
      )}
    </div>
  )
}
