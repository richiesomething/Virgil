export default function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max ? Math.round((value / max) * 100) : 0
  return (
    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={`${pct}% read`}>
      <div className="progress__fill" style={{ width: `${pct}%` }} />
    </div>
  )
}
