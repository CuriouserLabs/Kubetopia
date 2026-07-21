import type { MetadataRoute } from "next";
import { LEVELS, TRACKS } from "@/lib/levels";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://play.kubequest.org";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/leaderboard`, changeFrequency: "daily", priority: 0.7 },
    ...TRACKS.map((t) => ({
      url: `${SITE_URL}/campaign/${t.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
    ...LEVELS.map((l) => ({
      url: `${SITE_URL}/play/${l.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
