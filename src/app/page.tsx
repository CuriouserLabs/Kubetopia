import type { Metadata } from "next";
import Link from "next/link";
import AuthButton from "@/components/ui/AuthButton";
import TrackProgressBadge from "@/components/TrackProgressBadge";
import { TRACKS } from "@/lib/levels";

export const metadata: Metadata = {
  title: "Kubetopia — learn Kubernetes by saving a tiny 3D world",
  alternates: { canonical: "/" },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "VideoGame",
  name: "Kubetopia",
  url: "https://play.kubequest.org",
  description:
    "An animated, browser-based Kubernetes simulator game. Pick your path — cluster admin (CKA-style city campaign) or app developer (CKAD-style hospital campaign) — and practice kubectl debugging, node failures, rollbacks, YAML, ConfigMaps, Secrets and readiness probes across story-driven missions.",
  genre: ["Educational", "Simulation"],
  gamePlatform: "Web browser",
  applicationCategory: "EducationalApplication",
  operatingSystem: "Any (WebGL browser)",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  educationalUse: "Kubernetes administration and application development practice",
  isPartOf: { "@type": "WebSite", name: "KubeQuest", url: "https://kubequest.org" },
};

const ROADMAP = [
  {
    icon: "🎲",
    name: "Challenge Mode",
    text: "“Surprise me” — seeded random incidents you can't memorize, in three difficulty tiers.",
  },
  {
    icon: "🌅",
    name: "The Daily Challenge",
    text: "One puzzle per day, the same for the whole world. Streaks, leaderboards, bragging rights.",
  },
  {
    icon: "🌩️",
    name: "The Living City",
    text: "Sign in, walk the plaza with other SREs — and when the storm hits, it hits everyone at once.",
  },
  {
    icon: "🏝️",
    name: "The Archipelago",
    text: "New districts beyond the city: the Harbor, the Observatory, the Frozen Datacenter…",
  },
];

export default function HomePage() {
  return (
    <main className="gamefront gate">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="gamefront__stars" aria-hidden />

      <header className="gamefront__top">
        <span className="gate__brand">☸️ Kubetopia</span>
        <AuthButton />
      </header>

      <section className="gate__hero">
        <div className="gate__isle" aria-hidden>
          <span className="gate__cloud gate__cloud--1">☁️</span>
          <span className="gate__island">🏝️</span>
          <span className="gate__cloud gate__cloud--2">☁️</span>
        </div>
        <h1 className="gate__title">KUBETOPIA</h1>
        <p className="gate__tagline">
          A tiny floating world runs on Kubernetes. <strong>You keep it alive.</strong>
        </p>
        <p className="gate__sub">
          Real <code>kubectl</code> commands · real failure patterns · cartoon consequences.
          No cluster, no sign-up — it all runs in your browser.
        </p>
        <a href="#paths" className="gate__cta">▾ Choose your path</a>
      </section>

      <section id="paths" className="gate__paths" aria-labelledby="paths-heading">
        <h2 id="paths-heading" className="gamefront__h2">Choose your path</h2>
        <div className="portals">
          {TRACKS.map((t) => (
            <Link key={t.id} href={`/campaign/${t.slug}`} className={`portal portal--${t.id}`}>
              <span className="portal__cert">{t.cert}</span>
              <span className="portal__icon" aria-hidden>{t.icon}</span>
              <span className="portal__role">{t.role}</span>
              <span className="portal__name">{t.title}</span>
              <span className="portal__tagline">{t.tagline}</span>
              <span className="portal__skills">
                {t.skills.map((s) => (
                  <span key={s} className="portal__skill">{s}</span>
                ))}
              </span>
              <span className="portal__footer">
                <TrackProgressBadge track={t.id} />
                <span className="portal__enter">Enter ▸</span>
              </span>
            </Link>
          ))}
        </div>
        <p className="gate__paths-note">
          Both paths share one town, one console and one save file — play them in any order.
        </p>
      </section>

      <section className="gate__roadmap" aria-labelledby="roadmap-heading">
        <h2 id="roadmap-heading" className="gamefront__h2">The island keeps growing</h2>
        <p className="gate__roadmap-note">From the roadmap — not playable yet, but the ferries are booked.</p>
        <div className="roadmap">
          {ROADMAP.map((r) => (
            <div key={r.name} className="roadmap__card">
              <span className="roadmap__icon" aria-hidden>{r.icon}</span>
              <span className="roadmap__name">{r.name}</span>
              <span className="roadmap__text">{r.text}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="gate__guild">
        <div className="guild-sign">
          <span className="guild-sign__icon" aria-hidden>🗺️</span>
          <div>
            <p className="guild-sign__title">Questing toward the real CKA/CKAD?</p>
            <p className="guild-sign__text">
              The <a href="https://kubequest.org" rel="noopener noreferrer" target="_blank">KubeQuest guild hall</a>{" "}
              builds your free study plan and tracks your progress — one sign-in works for both worlds.
            </p>
          </div>
        </div>
      </section>

      <footer className="gamefront__footer">
        <p>
          Kubetopia is a learning simulator: the cluster is simulated, the incidents are real-world
          patterns. Part of{" "}
          <a href="https://kubequest.org" rel="noopener noreferrer" target="_blank">KubeQuest</a> — pairs well with the
          official{" "}
          <a href="https://kubernetes.io/docs/home/" rel="noopener noreferrer" target="_blank">
            Kubernetes documentation
          </a>.
        </p>
      </footer>
    </main>
  );
}
