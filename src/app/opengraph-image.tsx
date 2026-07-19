import { ImageResponse } from "next/og";
import { floatingIslandSvg, helmMarkSvg } from "./brand-mark";

// Social share card (Open Graph — Facebook, LinkedIn, Slack, Discord, etc.)
export const alt =
  "Kubetopia — the animated Kubernetes simulator game. Part of KubeQuest.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const svgDataUri = (svg: string) =>
  `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

const STARS = [
  [70, 70], [150, 130], [240, 60], [330, 150], [90, 260], [200, 330],
  [60, 430], [180, 470], [1120, 90], [1050, 200], [1150, 300], [980, 120],
  [1100, 470], [1010, 400], [900, 70], [820, 520],
];

export default function OpengraphImage() {
  const island = svgDataUri(floatingIslandSvg());
  const helm = svgDataUri(helmMarkSvg());
  return new ImageResponse(
    (
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
        {/* starfield */}
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

        {/* left: copy */}
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
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

          <div
            style={{
              display: "flex",
              fontSize: 128,
              fontWeight: 800,
              letterSpacing: -3,
              lineHeight: 1,
              color: "#fbbf24",
            }}
          >
            Kubetopia
          </div>

          <div
            style={{
              display: "flex",
              fontSize: 40,
              fontWeight: 600,
              color: "#e0f2fe",
              marginTop: 22,
              maxWidth: 600,
              lineHeight: 1.25,
            }}
          >
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

        {/* right: island illustration */}
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={island} width={470} height={500} alt="" />
        </div>
      </div>
    ),
    { ...size }
  );
}
