import type { Metadata, Viewport } from "next";
import { Baloo_2, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// Rounded display face for the game-front pages (landing & campaign heroes).
const baloo = Baloo_2({ variable: "--font-display", subsets: ["latin"], weight: ["600", "700", "800"] });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://play.kubequest.org";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Kubetopia — the animated Kubernetes simulator game",
    template: "%s · Kubetopia",
  },
  description:
    "Practice real Kubernetes administration in a cartoon 3D town. Debug CrashLoopBackOffs, drain failing nodes, roll back bad deploys, fix YAML manifests and survive cluster storms across an ever-growing set of story-driven missions — right in your browser. Part of KubeQuest.",
  keywords: [
    "Kubernetes simulator",
    "Kubernetes game",
    "learn Kubernetes",
    "kubectl practice",
    "Kubernetes administration",
    "Kubernetes YAML practice",
    "CKA practice",
    "CKAD practice",
    "DevOps game",
    "SRE training",
    "KubeQuest",
  ],
  // Static raster assets on purpose: social crawlers (LinkedIn especially) are
  // unreliable with generated image routes and never render SVG.
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  manifest: "/site.webmanifest",
  openGraph: {
    title: "Kubetopia — the animated Kubernetes simulator game",
    description:
      "Debug pods, drain nodes, fix YAML and survive cluster storms in a cartoon 3D town. Story-driven Kubernetes missions, in your browser.",
    url: SITE_URL,
    siteName: "Kubetopia",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        type: "image/jpeg",
        alt: "Kubetopia — learn Kubernetes by saving a tiny 3D town",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kubetopia — learn Kubernetes by saving a tiny 3D town",
    description:
      "A game-like Kubernetes simulator: real kubectl commands, real failure scenarios, cartoon consequences. Part of KubeQuest.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Kubetopia — learn Kubernetes by saving a tiny 3D town",
      },
    ],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#326ce5",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${baloo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
