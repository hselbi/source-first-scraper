/** A single extracted record. Deliberately loose: every strategy must be able
 *  to produce the same shape regardless of where the data came from. */
export interface Item {
  url: string;
  title: string;
  price?: string;
  [key: string]: unknown;
}

/** Where a result came from, and what it cost us to get it. */
export type StrategyName = "sitemap" | "jsonApi" | "html" | "browser";

export interface StrategyResult {
  strategy: StrategyName;
  items: Item[];
  requests: number;
  ms: number;
}

/** A strategy is anything that can try to produce items for a target.
 *  Returning null means "this source is not available here", which is a
 *  normal outcome, not an error: the resolver moves down the ladder. */
export interface Strategy {
  name: StrategyName;
  run(target: Target): Promise<StrategyResult | null>;
}

export interface Target {
  /** Short id, also the output filename. */
  id: string;
  baseUrl: string;
  /** Optional sitemap override; defaults to /sitemap.xml */
  sitemap?: string;
  /** Internal JSON endpoint, if the site has one worth trying. */
  jsonApi?: { url: string; itemsPath?: string; map?: Record<string, string> };
  /** Server-rendered HTML: parsed with a plain GET, no browser. */
  html?: { listUrl: string; item: string; title: string; price?: string };
  /** Last resort. Only for pages that genuinely build their DOM in JS. */
  browser?: { listUrl: string; item: string; title: string; price?: string };
  /** Fields every item must carry. Defaults to title only: plenty of API
   *  sources have no per-item URL and that is not a defect. */
  requiredFields?: string[];
  /** Minimum items a run must return to be considered healthy. */
  expectMinItems: number;
}
