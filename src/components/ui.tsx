import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import Icon from './Icon'

// ── Sheet ───────────────────────────────────────────────────────────────────

interface SheetProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  /** Visually hidden title for sheets that show their own heading. */
  label?: string
  size?: 'content' | 'large'
  children: ReactNode
}

/**
 * Bottom sheet (a centred dialog on desktop). Each open sheet adds a history
 * entry, so the iOS back-swipe or Android back button closes it instead of
 * leaving the page. Drag the handle down, tap the scrim or press Esc to close.
 */
export function Sheet({ open, onClose, title, label, size = 'content', children }: SheetProps) {
  const titleId = useId()
  const panel = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const [dragY, setDragY] = useState(0)
  const drag = useRef<{ y: number; t: number } | null>(null)

  useEffect(() => {
    if (!open) return
    history.pushState({ sheet: true }, '')
    const opener = document.activeElement as HTMLElement | null
    const onPop = () => onCloseRef.current()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && history.back()
    window.addEventListener('popstate', onPop)
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    requestAnimationFrame(() => panel.current?.focus())
    return () => {
      window.removeEventListener('popstate', onPop)
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      opener?.focus?.()
    }
  }, [open])

  if (!open) return null

  const close = () => history.back()
  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { y: e.clientY, t: Date.now() }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (drag.current) setDragY(Math.max(0, e.clientY - drag.current.y))
  }
  const onPointerUp = (e: React.PointerEvent) => {
    if (!drag.current) return
    const dy = e.clientY - drag.current.y
    const v = dy / Math.max(1, Date.now() - drag.current.t)
    drag.current = null
    const h = panel.current?.offsetHeight ?? 400
    if (dy > h * 0.25 || v > 0.5) close()
    else setDragY(0)
  }

  return (
    <>
      <div className="scrim" onClick={close} />
      <div
        ref={panel}
        className={'sheet' + (size === 'large' ? ' sheet--large' : '')}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : label}
        tabIndex={-1}
        style={dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
      >
        <div className="sheet__inner">
          <div className="sheet__grab" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
            <span />
          </div>
          {title && (
            <div className="sheet__head">
              <h2 id={titleId}>{title}</h2>
              <button className="icon-btn" onClick={close} aria-label="Close">
                <Icon name="x" />
              </button>
            </div>
          )}
          <div className="sheet__body">{children}</div>
        </div>
      </div>
    </>
  )
}

/** Close a sheet, then (once the history entry is gone) navigate somewhere else. */
export function leaveSheetTo(hash: string) {
  window.location.replace(hash.startsWith('#') ? hash : '#' + hash)
}

// ── Toast ───────────────────────────────────────────────────────────────────

interface ToastState {
  id: number
  text: ReactNode
  action?: { label: string; run: () => void }
}

let toast: ToastState | null = null
const toastListeners = new Set<() => void>()
let timer = 0

export function showToast(text: ReactNode, action?: ToastState['action']) {
  toast = { id: Date.now(), text, action }
  toastListeners.forEach((l) => l())
  clearTimeout(timer)
  timer = window.setTimeout(hideToast, action ? 6000 : 4000)
}

export function hideToast() {
  toast = null
  toastListeners.forEach((l) => l())
}

export function ToastHost() {
  const t = useSyncExternalStore(
    (l) => (toastListeners.add(l), () => toastListeners.delete(l)),
    () => toast,
  )
  if (!t) return null
  return (
    <div className="toast" role="status" aria-live="polite" key={t.id}>
      <span className="toast__text">{t.text}</span>
      {t.action && (
        <button
          className="toast__action"
          onClick={() => {
            t.action!.run()
            hideToast()
          }}
        >
          {t.action.label}
        </button>
      )}
    </div>
  )
}

// ── Small pieces ────────────────────────────────────────────────────────────

/** Circular progress ring. */
export function Ring({ value, size = 18, stroke = 2.5, label }: { value: number; size?: number; stroke?: number; label?: string }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value))
  return (
    <svg className="ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <circle className="ring__track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
      <circle className="ring__fill" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeDasharray={c} strokeDashoffset={c * (1 - v)} />
    </svg>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: ReactNode; count?: number }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div className="segmented" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => {
            const i = options.findIndex((x) => x.value === value)
            if (e.key === 'ArrowRight') onChange(options[(i + 1) % options.length].value)
            if (e.key === 'ArrowLeft') onChange(options[(i - 1 + options.length) % options.length].value)
          }}
        >
          {o.label}
          {o.count !== undefined && <span className="count">{o.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="switch-row">
      <span>{label}</span>
      <input type="checkbox" role="switch" className="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}
