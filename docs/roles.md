# Roles & permissions in Helm

## The honest starting point

Helm is a front-end-only application. Every record lives in this browser's
`localStorage`, where anyone with the device or DevTools can read and rewrite it.

**There is no authentication and no authorisation here.** What exists is a
*persona system*: you choose who you are, and the interface reshapes around that
choice. That is genuinely useful — it removes noise, it prevents mistakes, and it
demonstrates the product — and it is not security.

Rules we hold ourselves to in the UI:

- Never the words *secure*, *encrypted*, *protected* or *private* about this layer.
- No password field, no "incorrect password", no credential of any kind. A hash
  checked in the client is theatre.
- The role switcher stays visible. Hiding it to make the demo feel real is the
  dishonest move.
- One permanent, non-dismissible line wherever a role is on screen:
  *"Demo workspace — roles shape what you see, they do not secure data.
  Everything is stored in this browser."* It lives in `DEMO_DISCLOSURE` in
  `src/auth/permissions.js` — import it, never retype it.

## The model

Two axes, not one ladder (the HoneyBook pattern):

1. **Scope** — how much of the company's work you see: `none` → `own` /
   `assigned` → `all`.
2. **Sensitivity** — operational data → contract value → cost and margin →
   invoices, receipts and exports → configuration.

A role is a point on both. That is why "can see other people's deals" and "can
see the money" are separate grants, and why a Sales Manager can have the whole
board in view while still only seeing rupees on their own deals.

### The five roles

| Role | Scope of work | Money |
|---|---|---|
| **Admin / Director** | Everything, including delete and settings | Value, cost, margin, invoices, exports |
| **Sales Manager** | Own deals and clients (flag can widen to all) | Contract value on **own** deals only. No cost, no margin, no export |
| **Event Manager** | Assigned events; reads the whole pipeline and production board | Contract value and cost on **assigned** events. **Never margin** |
| **Finance / Accounts** | Reads everything, edits nothing operational | Everything financial. The only non-Admin role that can export |
| **Crew / On-site** | Assigned events only | Nothing. No value, no cost, no documents |

### The two deliberate calls

- **Sales Manager sees money only on their own deals.** Priya carries
  `canViewAllPipelines`, so she watches the whole board — but that flag widens
  whose *work* she sees, never whose *money*.
- **Event Manager sees contract value but never margin.** Arjun needs the
  contract value to size the production and the vendor costs he negotiates.
  Margin prices the company's own position and stays with Director and Finance.
  No role grants it; only a per-person `canSeeMargin` flag can.

### Per-person override flags

A small fixed role set plus a couple of opt-in toggles (the Dubsado pattern),
rather than a sixth role for every exception:

- `canViewAllPipelines` — widens operational visibility to `all`. Touches no
  money key.
- `canSeeMargin` — opens cost and margin at the person's own record scope.

## Using it in code

```js
import { can, filterByScope, maskMoney } from '../auth/permissions.js';
import { session } from '../auth/session.js';

const user = session.getUser();

if (can(user, 'edit', 'deal', deal)) { /* show the edit button */ }
const visible = filterByScope(user, 'view', 'deal', allDeals);
cell.textContent = maskMoney(user, deal, formatMoney(deal.netValue));
```

- `can(user, action, resource, record)` is **pure** — no storage, no DOM, no
  clock — and **default-deny**: a key missing from the matrix is a refusal.
- Omit `record` to ask "may they reach this surface at all?" The answer is yes
  for scoped roles, meaning *yes, filtered*.
- Never inline a role check (`if (user.role === 'admin')`). Add the key to the
  matrix instead. That is the whole reason this module exists.

## Files

| File | What it is |
|---|---|
| `src/auth/permissions.js` | The matrix as data, plus `can` / `scopeFor` / `filterByScope` / `permissionRows` |
| `src/auth/users.js` | The seeded team, with override flags |
| `src/auth/session.js` | Current persona; observable, persisted under `helm_session_v1` |
| `src/components/SignInScreen.js` | "Sign in as" persona cards |
| `src/components/RoleBadge.js` | Top-bar identity + visible switcher |
| `src/components/RolesMatrixScreen.js` | Renders the live matrix as a table |

## What changes when a backend lands

Almost nothing in this repo, which is the point of writing it this way.

1. **`PERMISSION_MATRIX` moves to the server unchanged** and becomes middleware.
   Every request resolves `scopeFor(user, action, resource)` and turns `own` /
   `assigned` into a `WHERE` clause on the query. The literal table is already
   the specification; it is not re-derived.
2. **`can()` runs in both places.** The server's answer is the real one. The
   client copy demotes to what it always was: UX, deciding which buttons render.
3. **`session.js` is replaced by a real session.** `signIn` posts credentials and
   the server sets an HttpOnly cookie; `getUser()` reads the server's `/me`
   response. The `subscribe`/`get` surface it exposes stays identical, so nothing
   that consumes it changes.
4. **`SignInScreen.js` becomes a real sign-in form** — and only then may it have
   a password field, because only then is there something to verify against.
5. **The disclosure line goes away** with the thing it was disclosing. Until the
   server exists, it stays, in every role-aware surface, undismissable.
6. **Field masking becomes server-side omission.** Today we render `—` where a
   user may not see a rupee figure; with a backend, the figure is never sent.
   `maskMoney()` keeps its signature and simply stops being the only line of
   defence.

Sensitive data — real client PII, bank details, signed contracts — should not be
put into this build at all until step 1 through 3 are done.
