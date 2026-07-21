import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import MissionGrid from "@/components/MissionGrid";
import AuthButton from "@/components/ui/AuthButton";
import { getTrack, levelsForTrack, TRACKS } from "@/lib/levels";

interface Props {
  params: Promise<{ track: string }>;
}

export function generateStaticParams() {
  return TRACKS.map((t) => ({ track: t.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { track } = await params;
  const info = getTrack(track);
  if (!info) return {};
  return {
    title: `${info.title} — ${info.cert} Kubernetes missions`,
    description: `${info.tagline} Story-driven ${info.cert} practice missions in the Kubetopia simulator: ${info.skills.join(", ")}.`,
    alternates: { canonical: `/campaign/${info.slug}` },
  };
}

export default async function CampaignPage({ params }: Props) {
  const { track } = await params;
  const info = getTrack(track);
  if (!info) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Kubetopia — ${info.title}`,
    description: info.tagline,
    itemListElement: levelsForTrack(info.id).map((l, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: l.name,
      url: `https://play.kubequest.org/play/${l.slug}`,
    })),
  };

  return (
    <main className={`gamefront campaign campaign--${info.id}`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="gamefront__stars" aria-hidden />
      <header className="gamefront__top">
        <Link href="/" className="gamefront__back">⬅ The Gateway</Link>
        <span className="gamefront__nav">
          <Link href="/leaderboard" className="gamefront__navlink">🏆 Leaderboards</Link>
          <AuthButton />
        </span>
      </header>

      <section className="campaign__hero">
        <div className="campaign__icon" aria-hidden>{info.icon}</div>
        <p className="campaign__role">{info.role} · <span className="campaign__cert">{info.cert}</span></p>
        <h1 className="campaign__title">{info.title}</h1>
        <p className="campaign__desc">{info.description}</p>
        <p className="campaign__cast">{info.cast}</p>
      </section>

      <section className="campaign__missions" aria-label="Missions">
        <MissionGrid track={info.id} />
      </section>

      <footer className="gamefront__footer">
        <p>
          Studying for the real {info.cert.replace("-style", "")} exam? Build your study plan at{" "}
          <a href="https://kubequest.org" rel="noopener noreferrer" target="_blank">kubequest.org</a> — one sign-in
          works for both.
        </p>
      </footer>
    </main>
  );
}
