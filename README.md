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

## Panorama assets

Every plate under `public/images` is a **true 2:1 equirectangular full sphere**, 3072 x 1536,
produced by `tools/pano360.py`. `npm run panorama:check` verifies all 64; `npm test` fails the
build if any plate is not a full sphere, is under 2048px, or exceeds the 4096px texture limit
that a long tail of mobile GPUs enforces.

### What the tool fixes

Measured on the original assets, every plate had three defects that made the sphere look wrong:

| Defect | Measured before | After |
|---|---|---|
| Left and right edges did not match (hard seam at yaw 180°) | edge delta 3–4x the interior delta | seam below the interior delta |
| Top/bottom rows still varied horizontally, so the poles smeared | nadir std up to 38 | under 2 |
| Half the plates were 1.79:1, stretching the whole sphere | 12% vertical stretch | exact 2:1 |

The pole fix is the interesting one. An equirectangular row at latitude φ stores a ring of
circumference `2π·cos(φ)` in the same pixel count the equator uses, so it is oversampled by
exactly `1/cos(φ)` — and that oversampling is what you see as radial streaking when you look
straight down. The tool blurs each row by that factor: zero at the horizon, 3px at 75°, and
steep only in the last couple of degrees. The outermost 1.8° ease to a true row mean, because
those rows *are* the pole.

### The honest limitation

These plates are wide photographs mapped onto a sphere. The geometry is now correct and
seamless, but the content behind the viewer is the photograph's own edges, not a real capture of
what is actually behind the camera. **Two flat images (a front and a back) do not fix this** —
at 110° + 150° they cover 260° of 360° and nothing above or below, which is why
`--reproject --rear` exists but is not what ships.

Genuine upgrades, in order of value:

1. **Shoot with a 360 camera** (Insta360 / Ricoh Theta). Log the tripod height — it turns one
   click on an object's floor contact into its real distance, which is what makes accurate
   item overlays possible.
2. **Generate true equirectangular images** with a tool that outputs the projection natively
   (Blockade Labs Skybox AI exports 8K equirect). One image per plate, no stitching.
3. Only then consider outpainting the existing plates.

### Regenerating

```bash
python3 tools/pano360.py in.jpg out.jpg      # convert one plate
npm run panorama:check                        # verify all 64
npm run panorama:manifest                     # rebuild src/data/panoramaMeta.js
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
