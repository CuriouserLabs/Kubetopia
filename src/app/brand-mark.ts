/**
 * Shared brand artwork for generated icons and social images.
 * These return raw SVG strings so they can be embedded as <img> data URIs
 * inside `next/og` ImageResponse (resvg renders full SVG, unlike Satori's
 * CSS subset). Keep in visual sync with the static favicon at app/icon.svg.
 */

const HELM_BLUE = "#326ce5";
const HUB_GOLD = "#f59e0b";

/** The Kubetopia helm mark (a cartoon ship's-wheel nod to Kubernetes' helm),
 *  white on a blue field. `bleed` fills the whole square (for apple-icon /
 *  masked contexts); otherwise it sits on a rounded tile. */
export function helmMarkSvg({ bleed = false }: { bleed?: boolean } = {}): string {
  const tile = bleed
    ? `<rect width="180" height="180" fill="${HELM_BLUE}"/>`
    : `<rect width="180" height="180" rx="40" fill="${HELM_BLUE}"/>`;
  // Heptagon vertices around center (90,90), radius 54, first point at top.
  const cx = 90;
  const cy = 90;
  const r = 54;
  const pts = Array.from({ length: 7 }, (_, k) => {
    const a = (-90 + k * (360 / 7)) * (Math.PI / 180);
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  });
  const spokes = pts
    .map(([x, y]) => `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(2)}" y2="${y.toFixed(2)}"/>`)
    .join("");
  const dots = pts
    .map(([x, y]) => `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="7.5"/>`)
    .join("");
  const poly = pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180">
    ${tile}
    <g stroke="#ffffff" stroke-width="8" stroke-linecap="round">${spokes}</g>
    <polygon points="${poly}" fill="none" stroke="#ffffff" stroke-width="11.5" stroke-linejoin="round"/>
    <g fill="#ffffff">${dots}</g>
    <circle cx="${cx}" cy="${cy}" r="17" fill="#ffffff"/>
    <circle cx="${cx}" cy="${cy}" r="8.5" fill="${HUB_GOLD}"/>
  </svg>`;
}

/** A cartoon floating island with node-buildings and glowing pods, echoing
 *  the game's 3D scene. Used as the hero illustration on social cards. */
export function floatingIslandSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="470" height="500" viewBox="0 0 470 500">
    <defs>
      <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#7ed957"/>
        <stop offset="1" stop-color="#57b845"/>
      </linearGradient>
      <linearGradient id="dirt" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#8a5a3c"/>
        <stop offset="1" stop-color="#5f3d28"/>
      </linearGradient>
    </defs>
    <!-- floating cloud -->
    <g fill="#ffffff" opacity="0.9">
      <ellipse cx="86" cy="120" rx="46" ry="24"/>
      <ellipse cx="122" cy="108" rx="34" ry="26"/>
      <ellipse cx="60" cy="110" rx="28" ry="20"/>
    </g>
    <!-- island underside -->
    <path d="M55 262 Q235 210 415 262 L300 452 Q235 500 170 452 Z" fill="url(#dirt)"/>
    <path d="M170 452 Q235 500 300 452 L280 470 Q235 505 190 470 Z" fill="#4b3020"/>
    <!-- grass cap -->
    <ellipse cx="235" cy="262" rx="182" ry="58" fill="url(#grass)"/>
    <ellipse cx="235" cy="256" rx="182" ry="52" fill="#8fe067"/>
    <!-- central tower (blue conical roof) -->
    <rect x="205" y="150" width="64" height="112" rx="6" fill="#f6efe1"/>
    <polygon points="200,152 274,152 237,92" fill="#2f6fed"/>
    <circle cx="237" cy="92" r="6" fill="#ffd766"/>
    <rect x="224" y="205" width="26" height="40" rx="4" fill="#5b7089"/>
    <!-- left house (red roof) -->
    <rect x="112" y="196" width="78" height="74" rx="5" fill="#f6efe1"/>
    <polygon points="104,198 198,198 151,150" fill="#c0392b"/>
    <rect x="140" y="232" width="24" height="38" rx="3" fill="#6b4a2f"/>
    <rect x="120" y="212" width="16" height="16" rx="2" fill="#9ec9e6"/>
    <!-- right house (orange roof) -->
    <rect x="286" y="204" width="70" height="66" rx="5" fill="#f6efe1"/>
    <polygon points="279,206 363,206 321,164" fill="#e08a3c"/>
    <rect x="300" y="224" width="15" height="15" rx="2" fill="#9ec9e6"/>
    <rect x="328" y="224" width="15" height="15" rx="2" fill="#9ec9e6"/>
    <!-- glowing pods -->
    <g>
      <rect x="150" y="286" width="30" height="30" rx="5" fill="#34d399"/>
      <rect x="150" y="286" width="30" height="9" rx="4" fill="#6ee7b7"/>
      <rect x="196" y="298" width="26" height="26" rx="5" fill="#38bdf8"/>
      <rect x="196" y="298" width="26" height="8" rx="4" fill="#7dd3fc"/>
      <rect x="286" y="292" width="28" height="28" rx="5" fill="#fbbf24"/>
      <rect x="286" y="292" width="28" height="8" rx="4" fill="#fcd34d"/>
    </g>
    <!-- a little flag -->
    <line x1="392" y1="238" x2="392" y2="286" stroke="#7a8aa0" stroke-width="4" stroke-linecap="round"/>
    <polygon points="392,240 420,248 392,258" fill="#38bdf8"/>
  </svg>`;
}
