// Structural validation.
// The expensive failure is a 200 with an empty array after a target changed
// its markup: nothing throws and nobody notices for days. This makes it loud.

import type { Item, Target } from "./types.js";

export interface Problem {
  kind: "empty" | "under-threshold" | "missing-field" | "suspicious-uniformity";
  detail: string;
}

export function validate(items: Item[], target: Target): Problem[] {
  const problems: Problem[] = [];

  if (items.length === 0) {
    problems.push({ kind: "empty", detail: "strategy returned zero items" });
    return problems; // nothing further is meaningful
  }

  if (items.length < target.expectMinItems) {
    problems.push({
      kind: "under-threshold",
      detail: `got ${items.length}, expected at least ${target.expectMinItems}`,
    });
  }

  // A field present on some items but missing on many usually means a selector
  // matched a wrapper rather than the element we wanted.
  for (const field of target.requiredFields ?? ["title"]) {
    const missing = items.filter((i) => !i[field]).length;
    if (missing > 0) {
      problems.push({
        kind: "missing-field",
        detail: `${missing}/${items.length} items missing "${field}"`,
      });
    }
  }

  // If every title is identical we almost certainly scraped a template, a
  // cookie wall or an error page rather than real records.
  const uniqueTitles = new Set(items.map((i) => i.title)).size;
  if (items.length > 3 && uniqueTitles === 1) {
    problems.push({
      kind: "suspicious-uniformity",
      detail: `all ${items.length} items share one title: "${items[0]!.title}"`,
    });
  }

  return problems;
}
