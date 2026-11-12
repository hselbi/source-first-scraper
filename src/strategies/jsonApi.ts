// Rung 2: the site's own JSON endpoint. Cleaner than the rendered page,
// changes less often than markup, usually defended less. Finding one is the
// highest-leverage move available.

import { politeFetch } from "../robots.js";
import type { Item, Strategy, StrategyResult, Target } from "../types.js";

/** Resolve "data.products" against a parsed body. */
function at(body: unknown, path?: string): unknown {
  if (!path) return body;
  return path.split(".").reduce<unknown>(
    (acc, key) =>
      acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined,
    body,
  );
}

export const jsonApiStrategy: Strategy = {
  name: "jsonApi",
  async run(target: Target): Promise<StrategyResult | null> {
    if (!target.jsonApi) return null;
    const started = Date.now();

    let res: Response;
    try {
      res = await politeFetch(target.jsonApi.url);
    } catch {
      return null;
    }
    if (!res.ok) return null;

    let body: unknown;
    try {
      body = await res.json();
    } catch {
      return null; // served HTML or an error page: treat as unavailable
    }

    const raw = at(body, target.jsonApi.itemsPath);
    if (!Array.isArray(raw)) return null;

    const map = target.jsonApi.map ?? {};
    const items: Item[] = raw.slice(0, 50).map((row) => {
      const r = row as Record<string, unknown>;
      const out: Item = {
        url: String(r[map.url ?? "url"] ?? ""),
        title: String(r[map.title ?? "title"] ?? ""),
      };
      if (map.price && r[map.price] != null) out.price = String(r[map.price]);
      return out;
    });

    if (items.length === 0) return null;
    return { strategy: "jsonApi", items, requests: 1, ms: Date.now() - started };
  },
};
