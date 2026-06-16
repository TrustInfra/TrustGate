import type { MetadataRoute } from "next";

const BASE_URL = "https://www.trustgated.xyz";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const routes: Array<{
    path: string;
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
    priority: number;
  }> = [
    { path: "", changeFrequency: "weekly", priority: 1.0 },
    { path: "/oracle", changeFrequency: "weekly", priority: 0.9 },
    { path: "/token-shield", changeFrequency: "weekly", priority: 0.9 },
    { path: "/dashboard", changeFrequency: "weekly", priority: 0.8 },
    { path: "/demo", changeFrequency: "monthly", priority: 0.7 },
    { path: "/roadmap", changeFrequency: "monthly", priority: 0.7 },
    { path: "/agents/live", changeFrequency: "daily", priority: 0.7 },
    { path: "/docs", changeFrequency: "weekly", priority: 0.8 },
    { path: "/docs/how-it-works", changeFrequency: "monthly", priority: 0.7 },
    { path: "/docs/developer", changeFrequency: "monthly", priority: 0.7 },
    { path: "/docs/integration", changeFrequency: "monthly", priority: 0.7 },
    { path: "/docs/local-setup", changeFrequency: "monthly", priority: 0.6 },
    { path: "/docs/agent-registration", changeFrequency: "monthly", priority: 0.6 },
    { path: "/docs/agent-loop", changeFrequency: "monthly", priority: 0.6 },
    { path: "/docs/payment-flow", changeFrequency: "monthly", priority: 0.6 },
    { path: "/docs/trust-scoring", changeFrequency: "monthly", priority: 0.6 },
    { path: "/docs/trust-tiers", changeFrequency: "monthly", priority: 0.6 },
    { path: "/docs/margin-analysis", changeFrequency: "monthly", priority: 0.6 },
    { path: "/docs/oracle", changeFrequency: "monthly", priority: 0.6 },
    { path: "/docs/contracts", changeFrequency: "monthly", priority: 0.6 },
    { path: "/docs/dashboard-guide", changeFrequency: "monthly", priority: 0.6 },
    { path: "/docs/widget-integration", changeFrequency: "monthly", priority: 0.6 },
    { path: "/docs/api-reference", changeFrequency: "monthly", priority: 0.6 },
  ];

  return routes.map((route) => ({
    url: `${BASE_URL}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
