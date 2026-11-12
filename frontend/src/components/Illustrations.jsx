/** Simple vector illustrations (no external images needed). */
export function ScooterIllustration({ variant = "petrol", className = "" }) {
  const electric = variant === "electric";
  const body = electric ? "#818576" : "#37403F";
  const accent = electric ? "#545E56" : "#14171C";
  return (
    <svg viewBox="0 0 240 140" className={className} role="img" aria-label={`${variant} scooter`}>
      <ellipse cx="120" cy="130" rx="100" ry="6" fill="#14171C" opacity="0.08" />
      {/* wheels */}
      {[55, 190].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="108" r="22" fill="#25282D" />
          <circle cx={cx} cy="108" r="10" fill="#E3E5E0" />
          <circle cx={cx} cy="108" r="3" fill="#25282D" />
        </g>
      ))}
      {/* rear body, floorboard, front leg */}
      <path d="M38 88 C40 60 70 48 110 52 L140 56 L150 92 L60 94 Z" fill={body} />
      <rect x="70" y="88" width="86" height="12" rx="6" fill={accent} />
      <path d="M160 40 L172 40 L192 100 L180 104 Z" fill={body} />
      {/* seat, handlebar, headlight */}
      <rect x="72" y="40" width="64" height="12" rx="6" fill={accent} />
      <path d="M160 40 L166 24 L190 22" stroke={accent} strokeWidth="5" strokeLinecap="round" fill="none" />
      <circle cx="194" cy="30" r="6" fill="#F6F7F5" stroke={accent} strokeWidth="2" />
      {electric && <path d="M104 62 L92 78 H103 L98 90 L114 72 H103 Z" fill="#F6F7F5" />}
    </svg>
  );
}

export function ChargingStationIllustration({ className = "" }) {
  return (
    <svg viewBox="0 0 90 150" className={className} role="img" aria-label="Charging station">
      <rect x="10" y="6" width="70" height="132" rx="14" fill="#545E56" />
      <rect x="20" y="18" width="50" height="62" rx="8" fill="#25282D" />
      <path d="M48 28 L32 56 H44 L40 72 L58 44 H46 Z" fill="#F6F7F5" />
      <rect x="28" y="96" width="34" height="8" rx="4" fill="#818576" />
      <rect x="4" y="136" width="82" height="10" rx="5" fill="#37403F" />
    </svg>
  );
}
