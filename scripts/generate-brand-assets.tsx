/* eslint-disable @next/next/no-img-element -- Satori rasterises plain <img>; next/image does not apply here. */
/**
 * Regenerates the static brand assets in `public/` (favicon, app icons and the
 * social share card) from the artwork defined here.
 *
 *   npx tsx scripts/generate-brand-assets.tsx
 *
 * These are committed as plain static files on purpose: social crawlers
 * (LinkedIn in particular) are unreliable with dynamically generated image
 * routes served from a query-string URL with no file extension, and they do
 * not render SVG at all. Rasterising once, here, keeps `/og-image.jpg` a
 * boring, cacheable file that every scraper understands.
 */
import { ImageResponse } from "next/og";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";

const PUBLIC_DIR = join(process.cwd(), "public");
const HELM_BLUE = "#326ce5";
const HUB_GOLD = "#f59e0b";

/* ----------------------------- artwork ------------------------------ */

/** The Kubetopia helm mark — a cartoon ship's-wheel nod to Kubernetes' helm. */
function helmMarkSvg({ bleed = false, size = 180 }: { bleed?: boolean; size?: number } = {}) {
  const s = size;
  const tile = bleed
    ? `<rect width="${s}" height="${s}" fill="${HELM_BLUE}"/>`
    : `<rect width="${s}" height="${s}" rx="${s * 0.222}" fill="${HELM_BLUE}"/>`;
  const cx = s / 2;
  const cy = s / 2;
  const r = s * 0.3;
  const pts = Array.from({ length: 7 }, (_, k) => {
    const a = (-90 + k * (360 / 7)) * (Math.PI / 180);
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  });
  const f = (n: number) => n.toFixed(2);
  const spokes = pts.map(([x, y]) => `<line x1="${cx}" y1="${cy}" x2="${f(x)}" y2="${f(y)}"/>`).join("");
  const dots = pts.map(([x, y]) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(s * 0.042)}"/>`).join("");
  const poly = pts.map(([x, y]) => `${f(x)},${f(y)}`).join(" ");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
    ${tile}
    <g stroke="#ffffff" stroke-width="${f(s * 0.044)}" stroke-linecap="round">${spokes}</g>
    <polygon points="${poly}" fill="none" stroke="#ffffff" stroke-width="${f(s * 0.064)}" stroke-linejoin="round"/>
    <g fill="#ffffff">${dots}</g>
    <circle cx="${cx}" cy="${cy}" r="${f(s * 0.094)}" fill="#ffffff"/>
    <circle cx="${cx}" cy="${cy}" r="${f(s * 0.047)}" fill="${HUB_GOLD}"/>
  </svg>`;
}

/** A cartoon floating island with node-buildings and glowing pods. */
function floatingIslandSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="470" height="500" viewBox="0 0 470 500">
    <defs>
      <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#7ed957"/><stop offset="1" stop-color="#57b845"/>
      </linearGradient>
      <linearGradient id="dirt" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#8a5a3c"/><stop offset="1" stop-color="#5f3d28"/>
      </linearGradient>
    </defs>
    <g fill="#ffffff" opacity="0.9">
      <ellipse cx="86" cy="120" rx="46" ry="24"/>
      <ellipse cx="122" cy="108" rx="34" ry="26"/>
      <ellipse cx="60" cy="110" rx="28" ry="20"/>
    </g>
    <path d="M55 262 Q235 210 415 262 L300 452 Q235 500 170 452 Z" fill="url(#dirt)"/>
    <path d="M170 452 Q235 500 300 452 L280 470 Q235 505 190 470 Z" fill="#4b3020"/>
    <ellipse cx="235" cy="262" rx="182" ry="58" fill="url(#grass)"/>
    <ellipse cx="235" cy="256" rx="182" ry="52" fill="#8fe067"/>
    <rect x="205" y="150" width="64" height="112" rx="6" fill="#f6efe1"/>
    <polygon points="200,152 274,152 237,92" fill="#2f6fed"/>
    <circle cx="237" cy="92" r="6" fill="#ffd766"/>
    <rect x="224" y="205" width="26" height="40" rx="4" fill="#5b7089"/>
    <rect x="112" y="196" width="78" height="74" rx="5" fill="#f6efe1"/>
    <polygon points="104,198 198,198 151,150" fill="#c0392b"/>
    <rect x="140" y="232" width="24" height="38" rx="3" fill="#6b4a2f"/>
    <rect x="120" y="212" width="16" height="16" rx="2" fill="#9ec9e6"/>
    <rect x="286" y="204" width="70" height="66" rx="5" fill="#f6efe1"/>
    <polygon points="279,206 363,206 321,164" fill="#e08a3c"/>
    <rect x="300" y="224" width="15" height="15" rx="2" fill="#9ec9e6"/>
    <rect x="328" y="224" width="15" height="15" rx="2" fill="#9ec9e6"/>
    <g>
      <rect x="150" y="286" width="30" height="30" rx="5" fill="#34d399"/>
      <rect x="150" y="286" width="30" height="9" rx="4" fill="#6ee7b7"/>
      <rect x="196" y="298" width="26" height="26" rx="5" fill="#38bdf8"/>
      <rect x="196" y="298" width="26" height="8" rx="4" fill="#7dd3fc"/>
      <rect x="286" y="292" width="28" height="28" rx="5" fill="#fbbf24"/>
      <rect x="286" y="292" width="28" height="8" rx="4" fill="#fcd34d"/>
    </g>
    <line x1="392" y1="238" x2="392" y2="286" stroke="#7a8aa0" stroke-width="4" stroke-linecap="round"/>
    <polygon points="392,240 420,248 392,258" fill="#38bdf8"/>
  </svg>`;
}

const dataUri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

const STARS: Array<[number, number]> = [
  [70, 70], [150, 130], [240, 60], [330, 150], [90, 260], [200, 330],
  [60, 430], [180, 470], [1120, 90], [1050, 200], [1150, 300], [980, 120],
  [1100, 470], [1010, 400], [900, 70], [820, 520],
];

/** The 1200x630 social share card. */
function ogCard() {
  const island = dataUri(floatingIslandSvg());
  const helm = dataUri(helmMarkSvg({ size: 180 }));
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        backgroundImage:
          "linear-gradient(135deg, #050914 0%, #0b1b3a 45%, #123a63 78%, #1c5f8c 100%)",
        color: "#ffffff",
        fontFamily: "sans-serif",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", inset: 0, display: "flex" }}>
        {STARS.map(([x, y], i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: i % 4 === 0 ? 6 : 3,
              height: i % 4 === 0 ? 6 : 3,
              borderRadius: 999,
              background: i % 4 === 0 ? "#fde68a" : "#e0f2fe",
              opacity: 0.85,
            }}
          />
        ))}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "72px 0 72px 80px",
          width: 700,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
          <img src={helm} width={64} height={64} alt="" />
          <div
            style={{
              display: "flex",
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: 2,
              color: "#93c5fd",
              padding: "8px 18px",
              borderRadius: 999,
              background: "rgba(147,197,253,0.14)",
              whiteSpace: "nowrap",
            }}
          >
            ANIMATED KUBERNETES SIMULATOR
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 128, fontWeight: 800, letterSpacing: -3, lineHeight: 1, color: "#fbbf24" }}>
          Kubetopia
        </div>

        <div style={{ display: "flex", fontSize: 40, fontWeight: 600, color: "#e0f2fe", marginTop: 22, maxWidth: 600, lineHeight: 1.25 }}>
          Learn Kubernetes by saving a tiny 3D town.
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 34 }}>
          {["kubectl", "debug pods", "drain nodes", "fix YAML"].map((c) => (
            <div
              key={c}
              style={{
                display: "flex",
                fontSize: 24,
                color: "#bae6fd",
                padding: "8px 18px",
                borderRadius: 12,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(147,197,253,0.28)",
              }}
            >
              {c}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", fontSize: 26, color: "#7dd3fc", marginTop: 40 }}>
          play.kubequest.org  ·  Part of KubeQuest
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          right: 40,
          top: 0,
          bottom: 0,
          width: 470,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <img src={island} width={470} height={500} alt="" />
      </div>
    </div>
  );
}

/* ------------------------------ output ------------------------------ */

async function png(element: React.ReactElement, width: number, height: number) {
  const res = new ImageResponse(element, { width, height });
  return Buffer.from(await res.arrayBuffer());
}

const squareMark = (size: number) => (
  <div style={{ display: "flex", width: "100%", height: "100%" }}>
    <img src={dataUri(helmMarkSvg({ bleed: true, size: 180 }))} width={size} height={size} alt="" />
  </div>
);

/** Wrap a PNG in a single-entry .ico container (PNG-in-ICO, supported since Vista). */
function pngToIco(pngBuf: Buffer, size: number): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // image count
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size >= 256 ? 0 : size, 0); // width
  entry.writeUInt8(size >= 256 ? 0 : size, 1); // height
  entry.writeUInt8(0, 2); // palette
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // colour planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(pngBuf.length, 8);
  entry.writeUInt32LE(header.length + entry.length, 12);
  return Buffer.concat([header, entry, pngBuf]);
}

async function main() {
  mkdirSync(PUBLIC_DIR, { recursive: true });

  // Crisp vector favicon for modern browsers.
  writeFileSync(join(PUBLIC_DIR, "icon.svg"), helmMarkSvg({ size: 32 }) + "\n");

  // Raster app icons (PWA / Android / iOS home screen).
  writeFileSync(join(PUBLIC_DIR, "icon-192.png"), await png(squareMark(192), 192, 192));
  writeFileSync(join(PUBLIC_DIR, "icon-512.png"), await png(squareMark(512), 512, 512));

  // Classic favicon.ico for legacy browsers and crawlers that probe /favicon.ico.
  writeFileSync(join(PUBLIC_DIR, "favicon.ico"), pngToIco(await png(squareMark(32), 32, 32), 32));

  // Social share card. Written as PNG, then converted to JPG when `sips`
  // (macOS) is available — matching the sibling KubeQuest repo's /og-image.jpg.
  const ogPng = join(PUBLIC_DIR, "og-image.png");
  writeFileSync(ogPng, await png(ogCard(), 1200, 630));
  try {
    execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "88", ogPng, "--out", join(PUBLIC_DIR, "og-image.jpg")], { stdio: "ignore" });
    if (existsSync(join(PUBLIC_DIR, "og-image.jpg"))) unlinkSync(ogPng);
    console.log("wrote public/og-image.jpg");
  } catch {
    console.log("wrote public/og-image.png (install sips/ImageMagick to emit JPG)");
  }

  console.log("wrote public/icon.svg, icon-192.png, icon-512.png, favicon.ico");
}

main();
