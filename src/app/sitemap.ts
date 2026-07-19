import type { MetadataRoute } from "next";
import { LEVELS, TRACKS } from "@/lib/levels";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://play.kubequest.org";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
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
