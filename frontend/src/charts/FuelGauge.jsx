/** Ring gauge. `percent` may be null when no level is recorded. */
export default function FuelGauge({ percent, label }) {
  const r = 52, c = 2 * Math.PI * r;
  const value = percent == null ? 0 : Math.max(0, Math.min(100, percent));
  return (
    <svg viewBox="0 0 140 140" className="mx-auto h-36 w-36" role="img" aria-label={`${label} ${percent == null ? "unknown" : value + " percent"}`}>
      <circle cx="70" cy="70" r={r} fill="none" stroke="#E3E5E0" strokeWidth="14" />
      <circle cx="70" cy="70" r={r} fill="none" stroke="#545E56" strokeWidth="14" strokeLinecap="round"
        strokeDasharray={`${(value / 100) * c} ${c}`} transform="rotate(-90 70 70)" />
      <text x="70" y="64" textAnchor="middle" fontSize="12" fill="#818576">{label}</text>
      <text x="70" y="86" textAnchor="middle" fontSize="24" fontWeight="800" fill="#14171C">{percent == null ? "-" : `${Math.round(value)}%`}</text>
    </svg>
  );
}
