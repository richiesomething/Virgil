import { applyTheme, prefs, type Theme } from '../lib/store'

const themes: { id: Theme; label: string; hint: string }[] = [
  { id: 'system', label: 'Auto', hint: 'Follows your device' },
  { id: 'light', label: 'Light', hint: 'Cream paper' },
  { id: 'sepia', label: 'Sepia', hint: 'Warm, low glare, easy on the eyes' },
  { id: 'dark', label: 'Dark', hint: 'For reading in the dark' },
]

/** Four swatches: Auto, Light, Sepia (easy on the eyes) and Dark. */
export default function ThemePicker() {
  const { theme } = prefs.use()
  const pick = (t: Theme) => {
    prefs.set((x) => ({ ...x, theme: t }))
    applyTheme(t)
  }
  return (
    <div className="theme-grid" role="radiogroup" aria-label="Theme">
      {themes.map((t) => (
        <button key={t.id} type="button" role="radio" aria-checked={theme === t.id} className={`theme-swatch theme-swatch--${t.id}`} title={t.hint} onClick={() => pick(t.id)}>
          <span className="theme-swatch__chip" aria-hidden="true">
            Aa
          </span>
          {t.label}
        </button>
      ))}
    </div>
  )
}
