export function RouteArt() {
  return <div className="route-art" role="img" aria-label="Illustrated truck route connecting pickup and delivery">
    <div className="art-top"><span>THE ROAD AHEAD</span><span className="art-dot" /></div>
    <svg viewBox="0 0 520 400" fill="none" aria-hidden="true">
      <defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" stroke="#fff" strokeOpacity=".05" /></pattern></defs>
      <rect width="520" height="400" fill="url(#grid)" />
      <path d="M-10 310L160 210L290 285L540 140M-10 100L170 0M320 420L540 290" stroke="#27364b" strokeWidth="38" />
      <path d="M45 310L155 245Q170 235 185 245L260 287Q275 297 290 287L457 190" stroke="#F97316" strokeWidth="3" strokeDasharray="8 8" />
      <circle cx="45" cy="310" r="10" fill="#F97316" /><circle cx="457" cy="190" r="10" fill="#F97316" />
      <g transform="translate(148 128)"><path d="M0 22L126 0L224 56L95 80Z" fill="#eef2f6" /><path d="M0 22V95L95 152V80Z" fill="#aebccf" /><path d="M95 80L224 56V130L95 152Z" fill="#d7e0ec" /><path d="M224 80L255 98L267 139L224 150L196 134V101Z" fill="#F97316" /><path d="M228 88L249 101L258 126L228 119Z" fill="#172337" /><ellipse cx="116" cy="150" rx="12" ry="17" fill="#0B1220" /><ellipse cx="206" cy="136" rx="12" ry="17" fill="#0B1220" /><ellipse cx="249" cy="143" rx="12" ry="17" fill="#0B1220" /></g>
      <text x="27" y="352" fill="#aebccf" fontSize="12" letterSpacing="2">PICKUP</text><text x="407" y="166" fill="#aebccf" fontSize="12" letterSpacing="2">DELIVERY</text>
    </svg>
    <div className="art-bottom"><span>Every route starts with a plan.</span><span aria-hidden="true">↗</span></div>
  </div>;
}
