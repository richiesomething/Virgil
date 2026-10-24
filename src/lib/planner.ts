import type { BookData } from '../types'
import type { BookPlan } from './store'

const DAY = 86_400_000

/** Local calendar date as YYYY-MM-DD. */
export const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

export function chapterMinutes(book: BookData, n: number, wpm: number): number {
  return (book.wordCounts[n - 1] ?? 0) / wpm
}

export function minutesBetween(book: BookData, from: number, to: number, wpm: number): number {
  let total = 0
  for (let n = from; n <= to; n++) total += chapterMinutes(book, n, wpm)
  return total
}

export interface PlanStats {
  remainingMinutes: number
  nextChapterMinutes: number | null
  todayMinutes: number
  todayChapters: number
  streak: number
  /** Average minutes per day over the last two weeks, if there's any history. */
  recentPace: number | null
  /** Minutes per day needed (date goal) or chosen (minutes goal). */
  dailyTarget: number | null
  projectedFinish: Date | null
  /** True when the date goal can't be met at a sane pace (over 3 hours a day). */
  behind: boolean
  bestStreak: number
  /** Distinct days with reading in the last two weeks. */
  activeDays: number
  chaptersPerWeek: number | null
  week: { day: Date; minutes: number }[]
}

export function planStats(book: BookData, upTo: number, plan: BookPlan, wpm: number, now = new Date()): PlanStats {
  const total = book.meta.chapterCount
  const remainingMinutes = minutesBetween(book, upTo + 1, total, wpm)
  const nextChapterMinutes = upTo < total ? chapterMinutes(book, upTo + 1, wpm) : null

  const today = dayKey(now)
  const read = plan.log.filter((e) => !e.bulk)
  const todays = read.filter((e) => dayKey(new Date(e.at)) === today)
  const todayMinutes = todays.reduce((s, e) => s + chapterMinutes(book, e.chapter, wpm), 0)

  // Streak: consecutive days with at least one chapter, counting back from today
  // (or from yesterday, so a streak isn't "lost" before today's reading).
  const days = new Set(read.map((e) => dayKey(new Date(e.at))))
  let streak = 0
  let cursor = startOfDay(now)
  if (!days.has(dayKey(cursor))) cursor = new Date(cursor.getTime() - DAY)
  while (days.has(dayKey(cursor))) {
    streak++
    cursor = new Date(cursor.getTime() - DAY)
  }

  const since = now.getTime() - 14 * DAY
  const recent = read.filter((e) => new Date(e.at).getTime() >= since)
  const firstRecent = recent.length ? Math.min(...recent.map((e) => new Date(e.at).getTime())) : null
  const spanDays = firstRecent === null ? 0 : Math.max(1, Math.ceil((now.getTime() - firstRecent) / DAY))
  const recentPace = recent.length ? recent.reduce((s, e) => s + chapterMinutes(book, e.chapter, wpm), 0) / Math.max(spanDays, 3) : null

  let dailyTarget: number | null = null
  let projectedFinish: Date | null = null
  let behind = false
  const goal = plan.goal
  if (remainingMinutes > 0) {
    if (goal?.type === 'minutes') {
      dailyTarget = goal.minutes
      projectedFinish = new Date(startOfDay(now).getTime() + Math.max(0, Math.ceil(remainingMinutes / goal.minutes) - 1) * DAY)
    } else if (goal?.type === 'date') {
      const [y, m, d] = goal.date.split('-').map(Number)
      const target = new Date(y, m - 1, d)
      const daysLeft = Math.max(1, Math.round((target.getTime() - startOfDay(now).getTime()) / DAY) + 1)
      dailyTarget = remainingMinutes / daysLeft
      projectedFinish = target
      behind = dailyTarget > 180
    } else if (recentPace && recentPace > 0 && activeDaysFor(recent) >= 3) {
      projectedFinish = new Date(startOfDay(now).getTime() + Math.ceil(remainingMinutes / recentPace) * DAY)
    }
  }

  // Best streak ever, and minutes read on each of the last seven days.
  const sortedDays = [...days].sort()
  let best = 0
  let run = 0
  let prev: number | null = null
  for (const d of sortedDays) {
    const [y, m, dd] = d.split('-').map(Number)
    const t = new Date(y, m - 1, dd).getTime()
    run = prev !== null && Math.round((t - prev) / DAY) === 1 ? run + 1 : 1
    best = Math.max(best, run)
    prev = t
  }
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfDay(now).getTime() - (6 - i) * DAY)
    const key = dayKey(d)
    const minutes = read.filter((e) => dayKey(new Date(e.at)) === key).reduce((s, e) => s + chapterMinutes(book, e.chapter, wpm), 0)
    return { day: d, minutes }
  })
  const activeDays = new Set(recent.map((e) => dayKey(new Date(e.at)))).size
  const chaptersPerWeek = recent.length ? (recent.length / Math.max(spanDays, 3)) * 7 : null

  return {
    remainingMinutes,
    nextChapterMinutes,
    todayMinutes,
    todayChapters: todays.length,
    streak,
    bestStreak: Math.max(best, streak),
    recentPace,
    activeDays,
    chaptersPerWeek,
    week,
    dailyTarget,
    projectedFinish,
    behind,
  }
}

/** "12 min", "1 hr 5 min", "38 hr". */
export function formatMinutes(m: number): string {
  const mins = Math.max(1, Math.round(m))
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const r = mins % 60
  return h >= 10 || !r ? `${h} hr` : `${h} hr ${r} min`
}

function activeDaysFor(entries: { at: string }[]) {
  return new Set(entries.map((e) => dayKey(new Date(e.at)))).size
}

/** "about 20 min" style estimate; approximate books get "≈". */
export function estimate(book: BookData, minutes: number): string {
  return (book.meta.wordCountsApproximate ? '≈ ' : '~') + formatMinutes(minutes)
}
