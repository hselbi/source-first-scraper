// Rung 4: a real browser. Slowest, most detectable, most fragile. Only for
// pages that genuinely build their DOM in JS.
// Playwright is optional: if absent this rung is unavailable, same as a
// target with no sitemap.

import { isAllowed, USER_AGENT } from "../robots.js";
import type { Item, Strategy, StrategyResult, Target } from "../types.js";

export const browserStrategy: Strategy = {
  name: "browser",
  async run(target: Target): Promise<StrategyResult | null> {
    if (!target.browser) return null;
    const { listUrl, item, title, price } = target.browser;
    if (!(await isAllowed(listUrl))) return null;

    let chromium: typeof import("playwright").chromium;
    try {
      ({ chromium } = await import("playwright"));
    } catch {
      return null; // optional dependency absent: rung unavailable
    }

    const started = Date.now();
    const browser = await chromium.launch();
    try {
      const ctx = await browser.newContext({ userAgent: USER_AGENT });
      const page = await ctx.newPage();

      // Block images, fonts and media. We want the DOM, not the page: this
      // typically cuts bytes and load time by well over half.
      await page.route("**/*", (route) =>
        ["image", "font", "media"].includes(route.request().resourceType())
          ? route.abort()
          : route.continue(),
      );

      await page.goto(listUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.waitForSelector(item, { timeout: 15_000 }).catch(() => {});

      const items: Item[] = await page.$$eval(
        item,
        (nodes, sel) =>
          nodes.slice(0, 50).map((n) => {
            const t = n.querySelector(sel.title);
            const p = sel.price ? n.querySelector(sel.price) : null;
            const a = n.querySelector("a");
            const out: Record<string, unknown> = {
              url: a ? (a as HTMLAnchorElement).href : "",
              title: t?.textContent?.trim() ?? "",
            };
            if (p) out.price = p.textContent?.trim() ?? "";
            return out;
          }),
        { title, price },
      );

      if (items.length === 0) return null;
      return { strategy: "browser", items: items as Item[], requests: 1, ms: Date.now() - started };
    } finally {
      await browser.close();
    }
  },
};
