# source-first-scraper

Most scrapers open a browser first. This one opens a browser last.

For every target it walks down a ladder and stops at the first source that
returns valid data:

| # | Rung | Cost | Why try it |
|---|------|------|-----------|
| 1 | `sitemap` | one XML fetch | Complete index, published by the site, survives markup changes |
| 2 | `jsonApi` | one JSON fetch | Cleaner than rendered HTML, changes less often, defended less |
| 3 | `html` | one GET + parse | Server-rendered pages don't need a browser |
| 4 | `browser` | a full page load | Only for DOM genuinely built in JS |

Every target moved up a rung costs less, breaks in fewer ways, and presents
less to detect. The cheapest request is the one that never opens a browser.

## Running it

```bash
bun run src/cli.ts --all          # every target
bun run src/cli.ts books-toscrape # one target
```

Output goes to `out/<target>.json`. Playwright is an optional dependency; without
it rung 4 is simply unavailable and the ladder stops at rung 3.

```
quotes-toscrape
    -  sitemap
  WON  jsonApi    10 176ms
  -> 10 items via jsonApi -> out/quotes-toscrape.json

books-toscrape
    -  sitemap
    -  jsonApi
  WON  html       20 284ms
  -> 20 items via html -> out/books-toscrape.json
```

Neither target needed a browser. That is the whole argument.

## Silent failure is the real problem

A scraper that throws is easy. The expensive one returns HTTP 200 and an empty
array because a target changed its markup, and nobody notices for three days.

`validate.ts` refuses a result rather than writing it when:

- zero items came back
- fewer items than the target's `expectMinItems`
- a required field is missing on any item
- every item shares one title (usually a cookie wall or error page, not records)

A rejected result is not fatal. The resolver logs it and drops to the next rung,
because a confidently wrong answer is worse than no answer. That is visible in
the report: `FAIL jsonApi 10` with the reason underneath.

## robots.txt

Checked before any fetch, cached per origin. A missing or unfetchable robots.txt
means allowed, which is what the standard says. An explicit `Disallow` matching
our token or `*` means the strategy reports itself unavailable and the ladder
moves on. The scraper identifies itself in its user-agent.

## Adding a target

One JSON file in `targets/`. Only `id`, `baseUrl` and `expectMinItems` are
required; give it whichever rungs apply.

```json
{
  "id": "books-toscrape",
  "baseUrl": "https://books.toscrape.com",
  "html": {
    "listUrl": "https://books.toscrape.com/catalogue/page-1.html",
    "item": "article.product_pod",
    "title": "h3 a",
    "price": "p.price_color"
  },
  "requiredFields": ["title", "url"],
  "expectMinItems": 10
}
```

## What's missing

Honest list, not a roadmap:

- **Volume anomaly alerting.** Validation catches zero and under-threshold, but a
  target that quietly drops from 500 to 400 items passes. Comparing against a
  rolling baseline is the next thing worth building.
- **No persistence.** Runs overwrite `out/`. Diffing runs would catch drift.
- **Sitemap parsing is regex, not XML.** Fine for the shape sitemaps actually
  take, wrong if a target uses namespaces unusually.
- **No concurrency.** Targets run in series. Deliberate while the target count is
  small, since politeness matters more than wall-clock here.

## Why it looks like this

I built scraping infrastructure across 20+ French e-commerce sites at Flippix,
where the goal was not only keeping data flowing but cutting what we spent on
third-party proxies. Working down this ladder was most of how that was achieved:
every target served from a sitemap or an internal JSON endpoint was a target that
cost nothing to defend against.
