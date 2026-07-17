import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://play.kubequest.org";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Kubetopia — the animated Kubernetes simulator game",
    template: "%s · Kubetopia",
  },
  description:
    "Practice real Kubernetes administration in a cartoon 3D town. Debug CrashLoopBackOffs, drain failing nodes, roll back bad deploys, fix YAML manifests and survive cluster storms across 7 story-driven levels — right in your browser. Part of KubeQuest.",
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
  openGraph: {
    title: "Kubetopia — the animated Kubernetes simulator game",
    description:
      "Debug pods, drain nodes, fix YAML and survive cluster storms in a cartoon 3D town. 7 story-driven Kubernetes missions, in your browser.",
    url: SITE_URL,
    siteName: "Kubetopia",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kubetopia — learn Kubernetes by saving a tiny 3D town",
    description:
      "A game-like Kubernetes simulator: real kubectl commands, real failure scenarios, cartoon consequences. Part of KubeQuest.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
