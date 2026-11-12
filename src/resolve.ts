// The ladder: cheapest source first, first valid result wins.
// null means "not available here" (ordinary). Items that fail validation are
// treated as a failure and we keep going: confidently wrong beats nothing.

import { sitemapStrategy } from "./strategies/sitemap.js";
import { jsonApiStrategy } from "./strategies/jsonApi.js";
import { htmlStrategy } from "./strategies/html.js";
import { browserStrategy } from "./strategies/browser.js";
import { validate, type Problem } from "./validate.js";
import type { Strategy, StrategyResult, Target } from "./types.js";

/** Order is the whole point of this file. Do not reorder casually. */
export const LADDER: Strategy[] = [sitemapStrategy, jsonApiStrategy, htmlStrategy, browserStrategy];

export interface Attempt {
  strategy: string;
  outcome: "won" | "unavailable" | "rejected";
  items?: number;
  ms?: number;
  problems?: Problem[];
}

export interface Resolution {
  target: string;
  result: StrategyResult | null;
  attempts: Attempt[];
  problems: Problem[];
}

export async function resolve(target: Target): Promise<Resolution> {
  const attempts: Attempt[] = [];

  for (const strategy of LADDER) {
    let res: StrategyResult | null = null;
    try {
      res = await strategy.run(target);
    } catch (err) {
      attempts.push({
        strategy: strategy.name,
        outcome: "rejected",
        problems: [{ kind: "empty", detail: String(err) }],
      });
      continue;
    }

    if (!res) {
      attempts.push({ strategy: strategy.name, outcome: "unavailable" });
      continue;
    }

    const problems = validate(res.items, target);
    if (problems.length > 0) {
      attempts.push({
        strategy: strategy.name,
        outcome: "rejected",
        items: res.items.length,
        ms: res.ms,
        problems,
      });
      continue;
    }

    attempts.push({
      strategy: strategy.name,
      outcome: "won",
      items: res.items.length,
      ms: res.ms,
    });
    return { target: target.id, result: res, attempts, problems: [] };
  }

  return {
    target: target.id,
    result: null,
    attempts,
    problems: [{ kind: "empty", detail: "every rung of the ladder failed" }],
  };
}
