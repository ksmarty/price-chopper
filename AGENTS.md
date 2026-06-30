# Onboarding for AI Agents

## Project Overview
Price Chopper takes a restaurant menu URL or PDF and returns a version with all prices removed. Built with SvelteKit 5 + TypeScript, deployed on Vercel (Node.js 22.x via adapter-vercel).

## Architecture

### Proxy Flow (Web Pages)
1. User visits `/go?url=<target_url>` 
2. Page renders an iframe with `src="/api/proxy?url=<target_url>&currency=auto"`
3. Server-side proxy (`src/routes/api/proxy/+server.ts`):
   - Fetches the target page HTML
   - Inlines all `<link rel="stylesheet">` CSS (fetches and inlines as `<style>`, rewrites font `url()` refs through font proxy)
   - Injects `<base href="<target_url>">` for relative URL resolution
   - Injects client script before `</body>`
4. Client script (`src/lib/client/price-remover.js`):
   - Runs immediately (not on load)
   - Rewrites font `url()` references in existing `<style>` elements through font proxy
   - Periodically scans and processes `<link rel="stylesheet">` and `<link rel="preload" as="style">` elements (fetches CSS through font proxy, inlines as `<style>`)
   - Deduplicates CSS URL fetches (same URL fetched once)
   - Observes `<head>` for dynamically-added `<link>` elements (Squarespace, etc.) via MutationObserver (childList + rel attribute changes)
   - Walks text nodes and replaces price patterns with same-length spaces
   - Removes overlay elements (`.location-blackout`, `.page-overlay`, etc.)
   - Strips price-related data attributes and microdata
   - Registers service worker for font proxy

### PDF Flow
1. User uploads PDF or enters PDF URL
2. Server processes via `src/lib/server/pdf-redacter.ts`:
   - Uses `pdfjs-dist` to find price text positions
   - Uses `pdf-lib` to draw white rectangles over prices
   - Caches result in memory (24h TTL)
3. Preview rendered via `@embedpdf/svelte-pdf-viewer` Drop-in `PDFViewer`

### Font Proxy
- All font/asset `url()` references in CSS are rewritten through `/api/font-proxy`
- Font proxy fetches the asset server-side, strips `Content-Encoding` headers, adds `Access-Control-Allow-Origin: *`
- Service Worker (`static/sw.js`) also intercepts font requests and routes through font proxy
- Deduplicated per URL

## Key Source Files
| File | Purpose |
|------|---------|
| `src/routes/api/proxy/+server.ts` | HTML proxy, CSS inlining, script injection, ORIGIN variable injection |
| `src/lib/client/price-remover.js` | Client-side price removal, font URL rewriting, CSS/script link processing |
| `src/routes/api/font-proxy/+server.ts` | CORS-safe asset proxy (CSS, fonts, JS, SVG) |
| `src/routes/api/clean-pdf/+server.ts` | PDF upload/processing endpoint |
| `src/lib/server/pdf-redacter.ts` | PDF text finding and white rectangle drawing |
| `src/routes/go/+page.svelte` | Result page with iframe or PDF viewer |
| `src/hooks.server.ts` | Catch-all proxy for dynamically-loaded assets from the iframe |
| `static/sw.js` | Service worker font proxy |
| `tests/e2e/price-removal.spec.ts` | E2E tests for price removal + PDF + real sites |
| `tests/e2e/tma-test.spec.ts` | E2E debug test for Squarespace CSS rendering |

## Known Issues & Constraints

### Squarespace Sites
- Squarespace JS dynamically adds `<link rel="stylesheet">` elements to `<head>` with absolute URLs
- These direct CDN loads fail with `ERR_CONTENT_DECODING_FAILED` inside the sandboxed iframe
- **Fix**: Client script's `fetchAndInline()` catches these links via MutationObserver, fetches CSS through font proxy (server-side fetch, handles encoding correctly), and inserts inlined `<style>` alongside the original `<link>`
- Observes both `childList` (new elements) and `rel` attribute changes (preload→stylesheet) on `<head>`
- The TreeWalker (`walk()`) only sees each text node individually, so neither `$` alone nor `8` alone matches price patterns
- **Fix**: `blankTextNodes()` blanks all text nodes under price-related selectors: `.currency-sign`, `.sqs-money-native`, `.menu-item-price-top`, `.menu-item-price-bottom`, `[class*="price"]`, `[class*="Price"]`, `[itemprop*="price"]`, `[data-price]`, `[data-product-price]`
- Idempotent: only sets `nodeValue` if the new value differs from old, preventing MutationObserver re-trigger loops

### Proxy CSS Inlining
- `inlineCss()` in `src/routes/api/proxy/+server.ts` fetches CSS from `<link rel="stylesheet">` tags and inlines as `<style>`
- The CSS files themselves may contain `<link rel="stylesheet">` patterns inside CSS `content:` property values
- `result.replace(full, ...)` would find these patterns inside previously-inlined `<style>` content first, replacing the WRONG occurrence and corrupting CSS with nested `<style>` tags
- **Fix**: Process matches in REVERSE order (last match first) so earlier indices don't shift. Use `result.substring(0, index) + replacement + result.substring(index + full.length)` instead of `result.replace(full, ...)` to target exact positions. See commit history for details.

### MutationObserver Freeze
- Body MutationObserver with `characterData: true` caused infinite loop: `clean()` blanks text → characterData mutation → `clean()` fires again → re-blanks already-blanked text, triggering another mutation
- **Fix**: Body observer uses `{ childList: true, subtree: true }` only (no `characterData`). Timers at 3s/10s/30s handle text-only changes in existing elements.

### Dynamic Script 404s
- Squarespace JS dynamically loads scripts (e.g., `floating-cart`) using `window.location.href` to construct URLs, which resolves to our origin inside the iframe (same-origin), causing 404s
- **Fix** (server): `src/hooks.server.ts` — catch-all `handle` hook intercepts requests to unknown paths with a `Referer` from `/api/proxy` and fetches the asset from the target origin server-side
- **Fix** (client): `proxyAddedScripts()` in `price-remover.js` recursively walks each mutation's `addedNodes` and rewrites `<script src>` through `/api/font-proxy` before the browser fetches (works in Chromium where fetch is scheduled as a separate task)

### SVG Cross-Origin
- SVG `<use xlink:href>` references to the same origin fail inside sandboxed iframe with "Unsafe attempt to load URL"
- **Fix**: Server-side proxy (`+server.ts`) rewrites `xlink:href` URLs through `/api/font-proxy`, same pattern as CSS `url()` references

### Sandbox Limitations
- Iframe sandbox: `allow-scripts allow-forms allow-popups allow-same-origin`
- Third-party widgets (OpenTable, Facebook) making credentialed cross-origin requests will fail
- Same-origin SVG `url()` references in CSS fail with "Unsafe attempt to load URL"
- Squarespace `api/census` XHR calls are CORS-blocked (no `Access-Control-Allow-Origin` on response)

### PDF Processing
- `pdfjs-dist` v2.16.105 in Node.js mode tries to `require('./pdf.worker.js')` at runtime — Vercel's bundler doesn't include the worker file
- **Fix**: Dynamically import `pdfjs-dist/build/pdf.worker.js` and set `globalThis.pdfjsWorker.WorkerMessageHandler` before calling `getDocument`
- Prices may be split across adjacent text items (e.g., "6." at one position and "5" at another) — `findPriceRects()` correctly merges adjacent digit/dot items
- Cache is in-memory only (cleared on server restart or Vercel instance spin-down)

## Testing
- E2E tests via Playwright: `npx playwright test`
- Tests run against local dev server (`npm run dev`, `reuseExistingServer: true`)
- Real site tests (Gia, Terroni, Morning After) verify proxy works against production sites
- Price removal tests use a local fixture server (static HTML)
- PDF test uploads `Example PDF.pdf`

## Build & Deploy
- `npm run build` — production build
- Deployed to Vercel via `vercel` CLI or GitHub integration
- `maxDuration: 30` configured in `svelte.config.js` adapter options
- Runtime: Node.js 22.x
