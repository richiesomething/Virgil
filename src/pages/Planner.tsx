import { useState } from 'react'
import Icon from '../components/Icon'
import { Ring, Segmented, Sheet, showToast } from '../components/ui'
import { useBook } from '../lib/book-context'
import { planFor, plans, prefs, updatePlan, type Goal } from '../lib/store'
import { chapterMinutes, dayKey, estimate, formatMinutes, minutesBetween, planStats } from '../lib/planner'

const longDate = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long' })
const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'narrow' })
const DAY = 86_400_000

export default function Planner() {
  const { book, upTo } = useBook()
  const all = plans.use()
  const { wpm } = prefs.use()
  const id = book.meta.id
  const plan = planFor(all, id)
  const s = planStats(book, upTo, plan, wpm)
  const total = book.meta.chapterCount
  const [setup, setSetup] = useState<0 | 1 | 2 | null>(null)

  if (upTo >= total) {
    return (
      <div className="empty">
        <h1>Book finished</h1>
        <p>Nothing left to plan. Well read.</p>
      </div>
    )
  }

  const left = total - upTo
  const daysTo = s.projectedFinish ? Math.max(0, Math.round((s.projectedFinish.getTime() - new Date().setHours(0, 0, 0, 0)) / DAY)) : null

  // How many upcoming chapters cover what's left of today's goal.
  let coverTo = upTo
  if (s.dailyTarget) {
    let need = s.dailyTarget - s.todayMinutes
    while (need > 0 && coverTo < total) {
      coverTo++
      need -= chapterMinutes(book, coverTo, wpm)
    }
  }
  const upcoming = Array.from({ length: Math.min(5, left) }, (_, i) => upTo + 1 + i)
  const maxWeek = Math.max(1, ...s.week.map((d) => d.minutes), s.dailyTarget ?? 0)

  return (
    <div className="stack">
      <h1 className="large-title">Reading plan</h1>

      <section className="card">
        {plan.goal ? (
          <>
            <p className="eyebrow">{plan.goal.type === 'date' ? (s.behind ? 'Tight schedule' : 'Finishing by') : 'On track to finish'}</p>
            <p className="big-date">
              {s.projectedFinish ? longDate.format(s.projectedFinish) : '—'}
              {daysTo !== null && <span className="small muted" style={{ fontFamily: 'var(--sans)', marginLeft: 8 }}>in {daysTo} days</span>}
            </p>
          </>
        ) : (
          <>
            <p className="eyebrow">No goal yet</p>
            <p style={{ margin: '0 0 12px' }}>
              {s.projectedFinish ? (
                <>
                  At your recent pace you’d finish around <strong>{longDate.format(s.projectedFinish)}</strong>.
                </>
              ) : (
                'Read a few days and we’ll project a finish date — or set a goal now.'
              )}
            </p>
            <button className="btn btn--primary btn--block" onClick={() => setSetup(0)}>
              Set a goal
            </button>
          </>
        )}
        <p className="muted small" style={{ margin: '8px 0 0' }}>
          {left} chapters · {book.meta.wordCountsApproximate ? '≈' : '~'}
          {formatMinutes(s.remainingMinutes)} left
          {s.dailyTarget && plan.goal?.type === 'date' ? ` · about ${Math.ceil(s.dailyTarget)} min a day` : ''}
        </p>
        {s.behind && (
          <p className="callout" style={{ marginTop: 12 }}>
            That’s over three hours a day. Want a later date?{' '}
            <button className="link" style={{ minHeight: 0 }} onClick={() => setSetup(1)}>
              Adjust plan
            </button>
          </p>
        )}
      </section>

      {plan.goal && (
        <section>
          <p className="eyebrow">Today</p>
          <div className="card" style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
            <div style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
              <Ring value={s.dailyTarget ? s.todayMinutes / s.dailyTarget : 0} size={96} stroke={8} label={`${Math.round(s.todayMinutes)} of ${Math.round(s.dailyTarget ?? 0)} minutes`} />
              <span style={{ position: 'absolute', textAlign: 'center', lineHeight: 1.1 }}>
                <strong style={{ fontSize: '1.25rem' }}>{Math.round(s.todayMinutes)}</strong>
                <br />
                <span className="small muted">of {Math.round(s.dailyTarget ?? 0)}</span>
              </span>
            </div>
            <div style={{ fontSize: '0.9375rem', lineHeight: 1.45 }}>
              {s.todayMinutes >= (s.dailyTarget ?? Infinity) ? (
                <p style={{ margin: 0 }}>
                  <strong>Today’s goal is done.</strong> Anything more is a bonus.
                </p>
              ) : (
                <p style={{ margin: 0 }}>
                  {coverTo > upTo + 1 ? `Chapters ${upTo + 1}–${coverTo}` : `Chapter ${upTo + 1}`} covers today’s goal
                  <span className="muted"> ({estimate(book, minutesBetween(book, upTo + 1, coverTo, wpm))})</span>
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      <section>
        <p className="eyebrow">Your reading</p>
        <div className="group stat-list">
          <div className="row">
            <Icon name="flame" className="icon--sm" />
            <span className="row__body">
              <span className="row__title">Streak</span>
            </span>
            <span className="row__meta">
              {s.streak} day{s.streak === 1 ? '' : 's'}
              {s.bestStreak > s.streak ? <span className="muted" style={{ fontWeight: 400 }}> · best {s.bestStreak}</span> : ''}
            </span>
          </div>
          <div className="row">
            <Icon name="clock" className="icon--sm" />
            <span className="row__body">
              <span className="row__title">Pace</span>
            </span>
            <span className="row__meta">{s.chaptersPerWeek ? `${s.chaptersPerWeek.toFixed(1)} chapters a week` : 'Not enough yet'}</span>
          </div>
        </div>
        <div className="card" style={{ marginTop: 10 }}>
          <p className="small muted" style={{ margin: '0 0 8px' }}>
            Last 7 days (minutes)
          </p>
          <div className="week" role="img" aria-label={`Minutes read each day this week: ${s.week.map((d) => Math.round(d.minutes)).join(', ')}`}>
            {s.week.map((d, i) => (
              <div key={i} className={'week__bar' + (dayKey(d.day) === dayKey(new Date()) ? ' week__bar--today' : '')}>
                <div
                  className={'week__fill' + (s.dailyTarget && d.minutes >= s.dailyTarget ? ' week__fill--met' : '')}
                  style={{ height: `${Math.max(3, (d.minutes / maxWeek) * 44)}px` }}
                />
                <span>{weekday.format(d.day)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <p className="eyebrow">Coming up</p>
        <div className="group stat-list">
          {upcoming.map((n) => (
            <div key={n} className="row">
              <span className="ch-row__num">{n}</span>
              <span className="row__body">
                <span className="row__title">Chapter {n}</span>
              </span>
              <span className="row__meta" style={{ fontWeight: 500 }}>
                {estimate(book, chapterMinutes(book, n, wpm))}
                <span className="muted" style={{ fontWeight: 400 }}> · {formatMinutes(minutesBetween(book, upTo + 1, n, wpm))} total</span>
              </span>
            </div>
          ))}
        </div>
        {book.meta.wordCountsApproximate && (
          <p className="small muted" style={{ margin: '8px 4px 0' }}>
            ≈ Times are estimates for this book: exact chapter lengths aren’t available.
          </p>
        )}
      </section>

      <section>
        <div className="group">
          <button className="row" onClick={() => setSetup(0)}>
            <span className="row__body">
              <span className="row__title" style={{ font: '500 0.9375rem var(--sans)' }}>Reading speed</span>
            </span>
            <span className="row__meta">{wpm} wpm</span>
            <Icon name="chevronRight" className="icon--sm chev" />
          </button>
          <button className="row" onClick={() => setSetup(1)}>
            <span className="row__body">
              <span className="row__title" style={{ font: '500 0.9375rem var(--sans)' }}>Goal</span>
            </span>
            <span className="row__meta">{goalLabel(plan.goal)}</span>
            <Icon name="chevronRight" className="icon--sm chev" />
          </button>
          {plan.goal && (
            <button
              className="row"
              onClick={() => {
                const before = plan.goal
                updatePlan(id, (p) => ({ ...p, goal: undefined }))
                showToast('Goal removed.', { label: 'Undo', run: () => updatePlan(id, (p) => ({ ...p, goal: before })) })
              }}
            >
              <span className="row__body">
                <span className="row__title" style={{ font: '500 0.9375rem var(--sans)', color: 'var(--accent)' }}>Remove goal</span>
              </span>
            </button>
          )}
        </div>
      </section>

      <PlanSetup step={setup} onClose={() => setSetup(null)} onStep={setSetup} />
    </div>
  )
}

function goalLabel(goal?: Goal) {
  if (!goal) return 'None'
  if (goal.type === 'minutes') return `${goal.minutes} min a day`
  const [y, m, d] = goal.date.split('-').map(Number)
  return `By ${longDate.format(new Date(y, m - 1, d))}`
}

const speeds = [
  { wpm: 180, name: 'Unhurried', note: 'Savouring every line' },
  { wpm: 230, name: 'Steady', note: 'A typical reading pace' },
  { wpm: 280, name: 'Brisk', note: 'Moving right along' },
]

function PlanSetup({ step, onClose, onStep }: { step: 0 | 1 | 2 | null; onClose: () => void; onStep: (s: 0 | 1 | 2) => void }) {
  const { book, upTo } = useBook()
  const p = prefs.use()
  const plan = planFor(plans.use(), book.meta.id)
  const [wpm, setWpm] = useState(p.wpm)
  const [adjust, setAdjust] = useState(false)
  const [type, setType] = useState<'minutes' | 'date'>(plan.goal?.type ?? 'minutes')
  const [minutes, setMinutes] = useState(plan.goal?.type === 'minutes' ? plan.goal.minutes : 30)
  const tomorrow = dayKey(new Date(Date.now() + DAY))
  const [date, setDate] = useState(plan.goal?.type === 'date' ? plan.goal.date : dayKey(new Date(Date.now() + 60 * DAY)))

  const remaining = minutesBetween(book, upTo + 1, book.meta.chapterCount, wpm)
  const finishAt = new Date(new Date().setHours(0, 0, 0, 0) + Math.max(0, Math.ceil(remaining / minutes) - 1) * DAY)
  const [y, m, d] = date.split('-').map(Number)
  const daysLeft = Math.max(1, Math.round((new Date(y, m - 1, d).getTime() - new Date().setHours(0, 0, 0, 0)) / DAY) + 1)
  const perDay = remaining / daysLeft

  const save = () => {
    prefs.set((x) => ({ ...x, wpm }))
    updatePlan(book.meta.id, (pl) => ({ ...pl, goal: type === 'minutes' ? { type, minutes } : { type, date } }))
    onStep(2)
  }

  return (
    <Sheet open={step !== null} onClose={onClose} title={step === 0 ? 'How fast do you read?' : step === 1 ? 'Set a pace' : 'All set'}>
      <div className="dots" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span key={i} className={i === step ? 'on' : ''} />
        ))}
      </div>
      {step === 0 && (
        <>
          <div className="choice" role="radiogroup" aria-label="Reading speed">
            {speeds.map((sp) => (
              <button key={sp.wpm} role="radio" aria-checked={wpm === sp.wpm} onClick={() => setWpm(sp.wpm)}>
                <strong>{sp.name}</strong>
                <span className="small muted">
                  {sp.wpm} words a minute · {sp.note}
                </span>
              </button>
            ))}
          </div>
          {upTo < book.meta.chapterCount && (
            <p className="callout" style={{ marginTop: 12 }}>
              Chapter {upTo + 1} would take about {formatMinutes(chapterMinutes(book, upTo + 1, wpm))}.
            </p>
          )}
          <button className="link" onClick={() => setAdjust(!adjust)}>
            {adjust ? 'Done adjusting' : 'Adjust'}
          </button>
          {adjust && (
            <label style={{ display: 'block' }}>
              <span className="small muted">{wpm} words a minute</span>
              <input type="range" min={150} max={350} step={10} value={wpm} onChange={(e) => setWpm(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--accent)', height: 44 }} />
            </label>
          )}
          <button className="btn btn--primary btn--block btn--lg" style={{ marginTop: 12 }} onClick={() => (prefs.set((x) => ({ ...x, wpm })), onStep(1))}>
            Next
          </button>
        </>
      )}
      {step === 1 && (
        <>
          <Segmented<'minutes' | 'date'>
            label="Goal type"
            value={type}
            onChange={setType}
            options={[
              { value: 'minutes', label: 'Minutes a day' },
              { value: 'date', label: 'Finish by a date' },
            ]}
          />
          {type === 'minutes' ? (
            <>
              <div className="stepper">
                <button className="icon-btn icon-btn--surface" onClick={() => setMinutes((v) => Math.max(10, v - 5))} aria-label="Fewer minutes">
                  <Icon name="minus" />
                </button>
                <output aria-live="polite">{minutes} min</output>
                <button className="icon-btn icon-btn--surface" onClick={() => setMinutes((v) => Math.min(180, v + 5))} aria-label="More minutes">
                  <Icon name="plus" />
                </button>
              </div>
              <p className="callout">You’d finish around {longDate.format(finishAt)}.</p>
            </>
          ) : (
            <>
              <label className="field" style={{ margin: '16px 0 12px' }}>
                <Icon name="calendar" className="icon--sm" />
                <input type="date" min={tomorrow} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Finish by" />
              </label>
              <p className="callout">
                {perDay > 180 ? 'That’s over 3 hours a day — want a later date?' : `That’s about ${Math.ceil(perDay)} minutes a day.`}
              </p>
            </>
          )}
          <button className="btn btn--primary btn--block btn--lg" style={{ marginTop: 16 }} onClick={save}>
            Save plan
          </button>
        </>
      )}
      {step === 2 && (
        <>
          <p>
            {type === 'minutes' ? `${minutes} minutes a day` : `Finish by ${longDate.format(new Date(y, m - 1, d))}`} at {wpm} words a minute. Each time
            you mark a chapter finished, Virgil updates your progress.
          </p>
          <button className="btn btn--primary btn--block btn--lg" onClick={() => history.back()}>
            Done
          </button>
        </>
      )}
    </Sheet>
  )
}
