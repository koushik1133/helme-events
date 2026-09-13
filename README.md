# Helm Events 360°

An interactive sales tool for event production. A Helm salesperson sits next to a client,
walks them through a 360° preview of the venue, swaps decor in and out live —
stage, chairs, backdrops, lighting, florals — and the cost quote updates in rupees as they
go. The client sees the room and the price at the same time, and signs off before anything
is built.

It is a **single-page, front-end-only application**. No login, no server, no database in
production. Everything a user does persists to their own browser.

---

## Quick start

```bash
npm ci
npm run dev        # http://localhost:3002
```

Requires **Node 20+** (enforced via `engines` in `package.json`).

### Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server on `:3002` with HMR **and** the local `/api/*` mock mounted as middleware. |
| `npm run build` | Production build into `dist/`. |
| `npm run preview` | Serves `dist/` on `:3002`, with the same `/api/*` mock as dev, so preview behaves like dev. |
| `npm run api` | Runs the local API standalone on `127.0.0.1:3011`. Optional — `npm run dev` already includes it. |
| `npm run seed` | Resets `src/data/backend_db.json` from the tracked `backend_db.seed.json`. |
| `npm test` | Contract tests (`node --test`, no framework). Run before every commit. |

---

## Architecture

```
index.html          shell: fonts, Pannellum (CDN), mount point
  └── src/main.js   Event360App — the single orchestrating class
        ├── data/           zones, catalog, scene variants, vendors  (static JS modules)
        ├── engine/         Viewer360 (Pannellum wrapper), AudioEngine
        ├── components/     ~34 vanilla-JS view classes, one per panel/modal
        ├── services/       apiService, storage, devApi (node-only)
        └── utils/          format.js — money/number/storage/escaping helpers
```

Deliberate constraints, please keep them:

- **Vanilla ES modules. No framework.** Classes, template strings, `innerHTML` rendering.
- **No new dependencies.** Runtime deps are exactly two: `three` and `canvas-confetti`.
- **`src/utils/format.js` is the single source of truth** for money, numbers, safe
  localStorage reads and HTML escaping. Do not re-implement any of it.

### Code splitting

`vite.config.js` emits three chunks: the app entry, `three`, and `confetti`. `three` is
~121 kB gzipped — roughly the size of the rest of the app — and is only needed by the 3D
editor, so `ThreeDLiveSpaceEditor` is loaded with a dynamic `import()` on first click.
Keep it that way; a static import of `three` anywhere in the entry graph puts 121 kB back
on first paint.

### Browser target

`build.target` is **`es2020`**, not `esnext`. This app is opened on clients' own iPads and
inside WhatsApp/LinkedIn in-app browsers, where `esnext` syntax fails to parse and yields a
white screen. Do not raise the target without a concrete reason.

---

## Data model

Four pieces, in dependency order.

### 1. Zones — `src/data/zones.js`

A **zone** is a physical area of the venue (`zone-stage`, `zone-banquet`, `zone-lounge`,
`zone-entrance`, `zone-fountain`, plus the India-mode zones). Each zone owns a 360°
panorama and a list of slots.

### 2. Slots

A **slot** is a decorated position inside a zone — "the main stage backdrop", "banquet
chairs". Each slot declares:

- `id` — e.g. `slot-chair-banquet`
- `defaultItemId` — what is shown before the user touches anything
- the catalog categories it will accept
- **quantity**: `slot.quantity`, or `slot.quantityByItem[itemId]` when different items
  come in different counts.

> **Quantity lives on the slot, never in the selection map.** This matters — see below.

### 3. Catalog — `src/data/catalog.js`

A flat list of purchasable **items** (`chair-chiavari-gold`, `stage-led-arch`, …), each
with a title, category, preview image and a **price in integer rupees**.

### 4. Selections — the live state

`activeSelections` is a **FLAT map of `slotId` → `itemId` string**:

```js
{
  "slot-stage-main":   "stage-led-arch",
  "slot-chair-banquet": "chair-chiavari-gold",
  "custom_text_slot-backdrop-photo": "Priya & Arjun · 12 Feb"
}
```

It is **never** `{ itemId, quantity }` objects. Quantities come from the zone slot. The
only other permitted keys are `custom_text_<slotId>` strings for user-typed signage.

The local API sanitizes this shape on both read and write; older stores containing the
legacy object shape are coerced back to strings on load.

---

## The money contract

Non-negotiable, because this is the number a client signs against.

- **Currency is INR.** Never `$`.
- **All prices are integer rupees.** No floats, no paise.
- **Never use bare `toLocaleString()` for money.** Indian digit grouping is `₹23,01,590`,
  not `₹2,301,590`. Use `formatMoney()` / `formatMoneyShort()` from `src/utils/format.js`.
- **Round each line once, then sum** — `sumLines()`. Summing then rounding makes line items
  disagree with the subtotal, which is exactly the kind of thing a client spots.
- **GST is 18%**, split by `computeGst(base, buyerState)`: CGST+SGST intra-state (seller is
  in Telangana), IGST inter-state. The halves always re-sum to the total.
- **Escape user text** with `escapeHtml()` before it goes into an `innerHTML` template.

---

## Persistence

There are two layers, and only the first one exists in production.

### localStorage — authoritative

Everything lives under one versioned namespace, defined in **`src/services/storage.js`**:

```
helm.v1.<name>
```

Rules:

- **Never type a raw localStorage key.** Import `K` from `src/services/storage.js`.
- **Never call `JSON.parse(localStorage.getItem(...))`.** Use `load()`/`save()`, which go
  through `readJSON`/`writeJSON` — a corrupt value must never blank the app.
- `migrateLegacyStorage()` runs once at boot and moves the old `event360_*` and
  `helme_events_*` keys across. It is idempotent and never clobbers a newer value.

### `/api/*` — optional, development only

A small JSON API implemented once in **`src/services/devApi.js`** and mounted two ways:
as Vite middleware (`npm run dev`, `npm run preview`) and as a standalone server
(`npm run api`). It persists to `src/data/backend_db.json`, which is **gitignored** —
`backend_db.seed.json` is the tracked seed.

Routes: `GET /api/health`, `GET|POST /api/state`, `POST /api/swap`, `GET /api/activity`,
`GET|POST /api/proposals`, `GET|POST /api/bookings`, `GET /api/vendors`. Anything else is a
real `404` with a JSON body.

**On a production deploy there is no API.** `fetch('/api/state')` returns the SPA's own
HTML with a 200, so `apiService` checks the content type and treats a non-JSON response as
"no API". The API may only ever *upgrade* a localStorage restore — it can never replace it
with nothing. That is why restore is localStorage-first.

The local API is a development convenience, not a backend: loopback-only, no auth, one
JSON file. It is not deployed and could not be — Vercel's filesystem is read-only. A real
multi-user backend would mean Vercel Postgres/KV behind serverless functions in `/api/*.js`.

---

## Deploy

Vercel, static. `vercel.json` at the repo root pins the build and adds what zero-config
does not:

- **SPA rewrite** that excludes `/api/`, `/assets/` and `/images/`, so a deep link serves
  the shell but a missing asset still 404s honestly instead of returning HTML.
- **Immutable caching** for `/assets/*` (content-hashed), one week for `/images/*`.
- **Security headers**: HSTS, `nosniff`, `X-Frame-Options`, `Referrer-Policy`,
  `Permissions-Policy`, and a CSP.

### About the CSP

It allows exactly what the app uses, and no more:

| Allowance | Why it is there |
|---|---|
| `https://cdn.jsdelivr.net` in `script-src` / `style-src` | Pannellum 2.5.6, the 360° viewer, is loaded from jsDelivr in `index.html`. |
| `https://fonts.googleapis.com` / `https://fonts.gstatic.com` | The Inter webfont. |
| `data:` and `blob:` in `img-src` / `media-src` / `connect-src` | Canvas textures (`THREE.CanvasTexture`, `canvas.toDataURL()`) and the `URL.createObjectURL` export/download paths. |
| `'unsafe-inline'` in `script-src` | Inline handlers still present in `index.html` and the components. Remove this the day those are gone. |

`'unsafe-eval'` is deliberately **not** granted — nothing in the app or in Pannellum needs
it. `object-src` is `'none'`.

> If you self-host Pannellum, delete `cdn.jsdelivr.net` from the CSP at the same time.
> That is a strict tightening and also removes a third-party single point of failure for
> the product's headline feature.

### Deploy checklist

1. `npm run build` passes.
2. Set the real domain in the `canonical` / `og:url` / `og:image` / `twitter:image` tags in
   `index.html`. **OG image URLs must be absolute** or no preview image is fetched.
3. `src/data/backend_db.json` is gitignored and `dist/` is untracked — confirm
   `git status` is clean.

---

## Known gaps

Honest list, so nobody rediscovers these:

- **No tests, no linter, no CI.** The minimum worth adding is a GitHub Action running
  `npm ci && npm run build`.
- **No analytics**, so there is no data on which demo tabs prospects actually open.
- **No global error handler** — a throw in `main.js` leaves a blank page with no signal.
- **Pannellum has no SRI hash** and no self-hosted fallback. `Viewer360.js` degrades to a
  flat image if it fails to load, so nothing crashes, but the 360° feature is gone.
- **`src/style.css` is one 132 kB render-blocking file.**
- **Panoramas are ~1 MB JPEGs.** WebP/AVIF would cut 60–70%.


---

## Panorama assets — read this before promising a client a "4K 360° tour"

`src/data/panoramaMeta.js` records the measured pixel dimensions of every plate, and
`Viewer360` picks its projection from them. There are two kinds of plate in this repo:

| Kind | Size | Count | How it renders |
|---|---|---|---|
| True equirectangular | 2048 × 1024 (2:1) | 32 | Full 360° sphere. Pan all the way round. |
| Wide-angle photograph | 1376 × 768 (1.79:1) | 32 | **Partial panorama**, 120° horizontal field of view. |

The second group are ordinary wide photos, not spherical captures. Wrapping one around a
full sphere — which is what the app used to do — puts a hard seam where the left and right
edges meet and smears both poles. Rendering them as a partial panorama is honest and looks
correct, but it is a mitigation, not a fix.

**Every plate for the three India verticals (election rally, mandap, summit) is in the
second group.** Those are the differentiating screens, so they are the first assets worth
re-shooting or regenerating as true 2:1 equirectangular images at 4096 × 2048. Nothing in
this repo exceeds 2048 px wide, so no part of the product is genuinely 4K today — do not
put "4K" in a proposal or on a pricing page until the assets exist.

To regenerate the manifest after adding assets:

```bash
find public/images -name '*.jpg' -exec sips -g pixelWidth -g pixelHeight {} +
```

## Tests

`test/contracts.test.mjs` pins the invariants that have actually broken here: quote
arithmetic (lines must equal the subtotal, CGST + SGST must equal the GST total, the
payment schedule must equal the grand total), the flat `slotId -> itemId` **string**
selection contract, catalog id uniqueness, event-type zone scoping, panorama metadata
coverage, and corrupt-localStorage survival.

```bash
npm test
```
