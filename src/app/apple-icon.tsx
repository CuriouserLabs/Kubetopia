import { ImageResponse } from "next/og";
import { helmMarkSvg } from "./brand-mark";

// iOS home-screen / bookmark icon.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  const src = `data:image/svg+xml;base64,${Buffer.from(helmMarkSvg({ bleed: true })).toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={180} height={180} alt="Kubetopia" />
      </div>
    ),
    { ...size }
  );
}
