// Rung 3: fetch the HTML and parse it. No browser.
//
// Most pages that "need a browser" don't. They render server-side and a plain
// GET plus a parse gets the same data for a fraction of the cost and none of
// the detection surface. Only pages that genuinely build their DOM in JS
// should fall through to rung 4.
//
// Uses Bun's HTMLRewriter so this stays dependency-free.

import { politeFetch } from "../robots.js";
import type { Item, Strategy, StrategyResult, Target } from "../types.js";

declare const HTMLRewriter: any;

export const htmlStrategy: Strategy = {
  name: "html",
  async run(target: Target): Promise<StrategyResult | null> {
    const cfg = target.html;
    if (!cfg || typeof HTMLRewriter === "undefined") return null;

    const started = Date.now();
    let res: Response;
    try {
      res = await politeFetch(cfg.listUrl);
    } catch {
      return null;
    }
    if (!res.ok) return null;

    const items: Item[] = [];
    let current: Partial<Item> | null = null;
    const push = () => {
      if (current?.title) items.push({ url: current.url ?? "", title: current.title, ...(current.price ? { price: current.price } : {}) } as Item);
      current = null;
    };

    const rewriter = new HTMLRewriter()
      .on(cfg.item, {
        element() {
          push();
          current = {};
        },
      })
      .on(cfg.title, {
        element(el: any) {
          if (!current) return;
          const href = el.getAttribute("href");
          if (href && !current.url) current.url = new URL(href, cfg.listUrl).href;
          // Listing anchors often truncate ("A Light in the ...") and carry the
          // full string in title=. Prefer the attribute when it is there.
          const attr = el.getAttribute("title");
          current.title = attr ? attr : "";
          current.titleFromAttr = Boolean(attr);
        },
        text(t: any) {
          if (current && !current.titleFromAttr) current.title = (current.title ?? "") + t.text;
        },
      });

    if (cfg.price) {
      rewriter.on(cfg.price, {
        element() {
          if (current) current.price = "";
        },
        text(t: any) {
          if (current && current.price !== undefined) current.price += t.text;
        },
      });
    }

    await rewriter.transform(res).text();
    push();

    const cleaned = items
      .map((i) => ({ ...i, title: i.title.trim(), ...(i.price ? { price: i.price.trim() } : {}) }))
      .filter((i) => i.title)
      .slice(0, 50);

    if (cleaned.length === 0) return null;
    return { strategy: "html", items: cleaned, requests: 1, ms: Date.now() - started };
  },
};
