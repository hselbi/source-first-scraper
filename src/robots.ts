// robots.txt check, run before any strategy.
// Missing or unfetchable robots.txt means allowed (per the standard).
// An explicit Disallow for our token or * means refused.

const CACHE = new Map<string, string | null>();

async function fetchRobots(origin: string): Promise<string | null> {
  if (CACHE.has(origin)) return CACHE.get(origin)!;
  let body: string | null = null;
  try {
    const res = await fetch(new URL("/robots.txt", origin), {
      headers: { "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(10_000),
    });
    body = res.ok ? await res.text() : null;
  } catch {
    body = null;
  }
  CACHE.set(origin, body);
  return body;
}

export const USER_AGENT =
  "source-first-scraper/0.1 (+https://github.com/hselbi/source-first-scraper)";

/** Rules that apply to us: our own token wins, otherwise the * group. */
function rulesFor(body: string, agent: string): string[] {
  const groups = new Map<string, string[]>();
  let current: string[] = [];
  for (const raw of body.split("\n")) {
    const line = raw.split("#")[0]!.trim();
    if (!line) continue;
    const [keyRaw, ...rest] = line.split(":");
    const key = keyRaw!.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (key === "user-agent") {
      current = groups.get(value.toLowerCase()) ?? [];
      groups.set(value.toLowerCase(), current);
    } else if (key === "disallow" && value) {
      current.push(value);
    }
  }
  const mine = agent.toLowerCase().split("/")[0]!;
  return groups.get(mine) ?? groups.get("*") ?? [];
}

export async function isAllowed(url: string): Promise<boolean> {
  const u = new URL(url);
  const body = await fetchRobots(u.origin);
  if (!body) return true; // no robots.txt served: permitted by the standard
  const path = u.pathname + u.search;
  return !rulesFor(body, USER_AGENT).some((rule) => path.startsWith(rule));
}

/** fetch() wrapper that refuses disallowed paths and identifies itself. */
export async function politeFetch(url: string): Promise<Response> {
  if (!(await isAllowed(url))) {
    throw new Error(`robots.txt disallows ${url}`);
  }
  return fetch(url, {
    headers: { "user-agent": USER_AGENT, accept: "*/*" },
    signal: AbortSignal.timeout(20_000),
  });
}
