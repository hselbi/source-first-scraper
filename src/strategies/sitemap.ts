// Rung 1: sitemap. One cheap XML fetch instead of a crawl, and it survives
// markup changes. Most sites publish one and almost nobody reads it.

import { politeFetch } from "../robots.js";
import type { Item, Strategy, StrategyResult, Target } from "../types.js";

/** Small, dependency-free XML extraction: sitemaps are regular enough that a
 *  full parser buys little here, and avoiding the dependency keeps the install
 *  trivial. If a target ever needs namespaces this should become a real parse. */
function locs(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]!);
}

function titleFromUrl(url: string): string {
  const last = new URL(url).pathname.split("/").filter(Boolean).pop() ?? "";
  return decodeURIComponent(last)
    .replace(/\.[a-z]+$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
}

export const sitemapStrategy: Strategy = {
  name: "sitemap",
  async run(target: Target): Promise<StrategyResult | null> {
    const started = Date.now();
    const url = target.sitemap ?? new URL("/sitemap.xml", target.baseUrl).href;
    let requests = 0;

    let res: Response;
    try {
      res = await politeFetch(url);
      requests++;
    } catch {
      return null; // disallowed or unreachable: not an error, just unavailable
    }
    if (!res.ok) return null;

    const xml = await res.text();
    if (!xml.includes("<loc")) return null;

    let urls = locs(xml);

    // A sitemap index points at further sitemaps. Follow one, not all: this is
    // a discovery pass, not a crawl, and one is enough to prove the source.
    if (/<sitemapindex/i.test(xml) && urls[0]) {
      try {
        const child = await politeFetch(urls[0]);
        requests++;
        if (child.ok) urls = locs(await child.text());
      } catch {
        return null;
      }
    }

    const items: Item[] = urls
      .filter((u) => !u.endsWith(".xml"))
      .slice(0, 50)
      .map((u) => ({ url: u, title: titleFromUrl(u) }));

    if (items.length === 0) return null;
    return { strategy: "sitemap", items, requests, ms: Date.now() - started };
  },
};
