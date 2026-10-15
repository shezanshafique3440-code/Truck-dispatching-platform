/** CSS-only illustration: no timers, animation library or client hydration. */
export function TruckConvoy() {
  return <div className="truck-scene" role="img" aria-label="Illustration of trucks travelling along a planned route">
    <div className="scene-heading"><span>THE ROAD AHEAD</span><span>Route illustration</span></div>
    <svg viewBox="0 0 640 380" fill="none" aria-hidden="true">
      <defs><linearGradient id="road-sky" x2="0" y2="1"><stop stopColor="#182e4b"/><stop offset="1" stopColor="#091421"/></linearGradient><linearGradient id="trailer" x2="1"><stop stopColor="#e7edf4"/><stop offset="1" stopColor="#9aadc4"/></linearGradient></defs>
      <rect width="640" height="380" rx="24" fill="url(#road-sky)"/>
      <circle cx="490" cy="105" r="65" fill="#ff9b51" opacity=".12"/>
      <path d="M0 210L105 130L195 210L330 115L480 215L570 160L640 210V380H0Z" fill="#243a50"/>
      <path d="M0 250L200 200L390 250L640 205V380H0Z" fill="#102337"/>
      <path d="M-40 340L680 235" stroke="#31445a" strokeWidth="92"/>
      <path className="road-dashes" d="M-40 340L680 235" stroke="#c8d0da" strokeWidth="2" strokeDasharray="25 25"/>
      <g className="convoy-truck convoy-far" transform="translate(360 195) scale(.62)"><Truck /></g>
      <g className="convoy-truck convoy-near" transform="translate(100 230)"><Truck /></g>
      <path d="M45 110H165M45 120H125" stroke="#6b829e" strokeWidth="2"/>
      <circle cx="45" cy="85" r="4" fill="#fb923c"/><path d="M56 85H220" stroke="#fb923c" strokeDasharray="4 6"/>
    </svg>
    <div className="scene-footer"><span className="scene-beacon"/> Your equipment. Your next move.<span aria-hidden="true">↗</span></div>
  </div>;
}
function Truck() {
  return <g><ellipse cx="121" cy="80" rx="145" ry="12" fill="#030b15" opacity=".4"/><rect x="0" y="-28" width="180" height="91" rx="5" fill="url(#trailer)"/><path d="M12-16V48M23-16V48M34-16V48M45-16V48M56-16V48M67-16V48M78-16V48M89-16V48M100-16V48M111-16V48M122-16V48M133-16V48M144-16V48M155-16V48M166-16V48" stroke="#8298b0" opacity=".35"/><path d="M184 4H222L249 35V67H184Z" fill="#f97316"/><path d="M194 12H217L234 35H194Z" fill="#0b2035"/><path d="M0 63H249" stroke="#53677c" strokeWidth="7"/><rect x="238" y="44" width="11" height="6" rx="2" fill="#fff4c8"/>{[26,52,161,218].map(x=><g key={x}><circle cx={x} cy="69" r="14" fill="#08101d"/><circle cx={x} cy="69" r="6" fill="#8da1b8"/></g>)}</g>;
}
