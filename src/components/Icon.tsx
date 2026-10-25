/**
 * Inline SVG icons (24×24, stroke-based, currentColor). Paths are hand-drawn in
 * the style of Lucide (ISC licence); no icon font or dependency.
 */
const paths: Record<string, string> = {
  today: 'M2 6.5C4.5 5 8 5 12 7c4-2 7.5-2 10-.5V19c-2.5-1.5-6-1.5-10 .5-4-2-7.5-2-10-.5Z M12 7v12.5',
  chapters: 'M9 6h11 M9 12h11 M9 18h11 M4 5v2 M3.5 11.2 5 10.5V13 M3.5 17h1.7l-1.7 2h1.7',
  cast: 'M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20 M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z M20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35 M15.5 4.15a3.5 3.5 0 0 1 0 6.7',
  glossary: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3Z M5 17a3 3 0 0 1 3-3h11 M9 8h6',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z M20 20l-4-4',
  books: 'M4 4h4v16H4Z M10 4h4v16h-4Z M16.5 4.5l3.5-1 3 15.5-3.5 1Z',
  back: 'M15 18l-6-6 6-6',
  chevronRight: 'M9 6l6 6-6 6',
  chevronDown: 'M6 9l6 6 6-6',
  check: 'M5 12.5l4.5 4.5L19 7',
  lock: 'M6 11h12v9H6Z M8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7Z',
  flame: 'M12 21c-3.9 0-6.5-2.6-6.5-6 0-3.7 3-5.5 3.8-9 2 1.2 3.2 3 3.2 5 1-.6 1.6-1.6 1.8-3 2.2 1.8 4.2 4.5 4.2 7 0 3.4-2.6 6-6.5 6Z',
  calendar: 'M4 6h16v14H4Z M4 10h16 M8 3v4 M16 3v4',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 7v5l3 2',
  filter: 'M4 6h16 M7 12h10 M10 18h4',
  x: 'M6 6l12 12 M18 6L6 18',
  undo: 'M9 14L4 9l5-5 M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  laurel: 'M12 21c-4-2-7-6-7-11 M12 21c4-2 7-6 7-11 M6 13c-1.5-.5-2.5-1.8-2.7-3.5 1.6.2 2.8 1.2 3.2 2.7 M5.3 9.5C3.9 8.8 3.3 7.4 3.4 5.8c1.5.4 2.4 1.6 2.6 3.1 M18 13c1.5-.5 2.5-1.8 2.7-3.5-1.6.2-2.8 1.2-3.2 2.7 M18.7 9.5c1.4-.7 2-2.1 1.9-3.7-1.5.4-2.4 1.6-2.6 3.1',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M19.4 13.5l1.6 1.2-2 3.4-1.9-.8a7 7 0 0 1-2.1 1.2L14.8 21h-4l-.3-2a7 7 0 0 1-2.1-1.2l-1.9.8-2-3.4 1.6-1.2a7 7 0 0 1 0-2.4L4.6 9.3l2-3.4 1.9.8a7 7 0 0 1 2.1-1.2L10.8 3h4l.3 2a7 7 0 0 1 2.1 1.2l1.9-.8 2 3.4-1.6 1.2a7 7 0 0 1 0 2.4Z',
  map: 'M9 4 3 6.5v13.5L9 17.5l6 2.5 6-2.5V4l-6 2.5Z M9 4v13.5 M15 6.5V20',
  family: 'M12 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z M6 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z M18 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z M12 8v4 M6 16v-4h12v4',
  plus: 'M12 5v14 M5 12h14',
  minus: 'M5 12h14',
  fit: 'M4 9V4h5 M20 9V4h-5 M4 15v5h5 M20 15v5h-5',
  pin: 'M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  nodes: 'M6 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z M18 11a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z M8 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z M8.2 6.4l7.6 2.2 M6.6 8l1 8 M16.3 10.7l-6.6 6.6',
  layers: 'M12 3 2 8l10 5 10-5Z M2 13l10 5 10-5 M2 17.5l10 5 10-5',
  list: 'M8 6h12 M8 12h12 M8 18h12 M4 6h.01 M4 12h.01 M4 18h.01',
  route: 'M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z M18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z M8 17h6.5a3.5 3.5 0 0 0 0-7h-5a3.5 3.5 0 0 1 0-7H16',
  external: 'M14 4h6v6 M20 4l-9 9 M18 14v6H4V6h6',
  recap: 'M3 12a9 9 0 1 0 3-6.7L3 8 M3 3v5h5 M12 7v5l3 2',
}

export type IconName = keyof typeof paths

export default function Icon({ name, size, className = '', label }: { name: IconName; size?: number; className?: string; label?: string }) {
  return (
    <svg
      className={`icon ${className}`}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      <path d={paths[name]} />
    </svg>
  )
}
