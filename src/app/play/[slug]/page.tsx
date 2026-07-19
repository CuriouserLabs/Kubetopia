import type { Metadata } from "next";
import { notFound } from "next/navigation";
import GameView from "@/components/game/GameView";
import { LEVELS, getLevelBySlug, missionNumber, trackOf } from "@/lib/levels";

interface Props {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return LEVELS.map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const level = getLevelBySlug(slug);
  if (!level) return {};
  const label = `${trackOf(level).toUpperCase()} Mission ${missionNumber(level)}`;
  return {
    title: `${label}: ${level.name}`,
    description: `${level.tagline} Practice ${level.skills.join(", ")} in this Kubernetes simulator mission.`,
    alternates: { canonical: `/play/${level.slug}` },
    // Interactive game state — nothing useful for crawlers beyond metadata.
    robots: { index: true, follow: true },
  };
}

export default async function PlayPage({ params }: Props) {
  const { slug } = await params;
  const level = getLevelBySlug(slug);
  if (!level) notFound();
  return <GameView levelId={level.id} />;
}
