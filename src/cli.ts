// Resolve one target or all, report what happened, write JSON.
// The per-rung report matters as much as the data: a target silently
// degrading from a JSON endpoint to a browser is a signal worth seeing.

import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { resolve as resolveTarget } from "./resolve.js";
import type { Target } from "./types.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

async function loadTargets(): Promise<Target[]> {
  const dir = join(ROOT, "targets");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  return Promise.all(
    files.map(async (f) => JSON.parse(await readFile(join(dir, f), "utf8")) as Target),
  );
}

function report(name: string, attempts: { strategy: string; outcome: string; items?: number; ms?: number; problems?: { detail: string }[] }[]) {
  console.log(`\n${name}`);
  for (const a of attempts) {
    const mark = a.outcome === "won" ? "WON " : a.outcome === "rejected" ? "FAIL" : "  - ";
    const cost = a.ms != null ? `${a.ms}ms` : "";
    console.log(`  ${mark} ${a.strategy.padEnd(9)} ${String(a.items ?? "").padStart(3)} ${cost}`);
    for (const p of a.problems ?? []) console.log(`       ${p.detail}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const all = args.includes("--all");
  const only = args.find((a) => !a.startsWith("--"));

  let targets = await loadTargets();
  if (!all && only) targets = targets.filter((t) => t.id === only);
  if (targets.length === 0) {
    console.error("no targets matched; run with --all or a target id");
    process.exit(1);
  }

  await mkdir(join(ROOT, "out"), { recursive: true });
  let failures = 0;

  for (const target of targets) {
    const res = await resolveTarget(target);
    report(target.id, res.attempts);

    if (res.result) {
      const path = join(ROOT, "out", `${target.id}.json`);
      await writeFile(path, JSON.stringify(res.result.items, null, 2));
      console.log(`  -> ${res.result.items.length} items via ${res.result.strategy} -> out/${target.id}.json`);
    } else {
      failures++;
      console.log(`  -> NO DATA: ${res.problems.map((p) => p.detail).join("; ")}`);
    }
  }

  console.log(`\n${targets.length - failures}/${targets.length} targets resolved.`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
