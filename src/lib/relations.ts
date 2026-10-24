import type { RelationType } from '../types'

/** Display order, legend labels and line styles; colours live in CSS (--rel-*). */
export const relationTypes: { type: RelationType; label: string; dash?: string }[] = [
  { type: 'family', label: 'Family' },
  { type: 'love', label: 'Love' },
  { type: 'friend', label: 'Friends & allies' },
  // Dashed: amber and green get close for some colour-blind readers in dark mode.
  { type: 'enemy', label: 'Enemies & rivals', dash: '6 4' },
  { type: 'work', label: 'Work & service', dash: '2 4' },
]

export const relationLabel = Object.fromEntries(relationTypes.map((r) => [r.type, r.label])) as Record<
  RelationType,
  string
>
