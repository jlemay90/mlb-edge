# AGENTS.md — MLB Edge Picks

This file is the authoritative handoff document for any AI coding agent (Codex, Claude, etc.) working on this codebase. Read it fully before making any changes.

---

## What This App Is

**MLB Edge Picks** is a subscription-based MLB betting intelligence platform. It fetches live game schedules, real-time odds, weather, and pitcher/team stats, runs them through a prediction engine, and surfaces ranked picks with edge scores to paying subscribers.

Live at:
- https://intelligentbettingmlbedgepicks.com (primary custom domain)
- https://mlbedge-fnjyc4zg.manus.space (Manus hosting domain)

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Tailwind CSS 4, Wouter (routing), shadcn/ui |
| Backend | Express 4, tRPC 11, Superjson |
| ORM | Drizzle ORM |
| Database | MySQL / TiDB (Cloud) |
| Auth | Manus OAuth (custom cross-domain handoff) |
| Payments | Stripe (live mode, subscription-based) |
| Build | Vite (client), esbuild (server), pnpm |
| Tests | Vitest (16 tests, all must pass) |
| Runtime | Node.js 22, TypeScript (strict) |

---

## How to Run

```bash
pnpm dev          # Start dev server (http://localhost:3000)
pnpm test         # Run all 16 Vitest tests
pnpm check        # TypeScript type-check (no emit)
pnpm build        # Production build (Vite + esbuild)
pnpm format       # Prettier format
```

The dev server serves both the Express API and the Vite-proxied React frontend on port 3000. There is no separate frontend dev server.

---

## Project Structure

```
mlb-edge/
├── client/
│   ├── src/
│   │   ├── pages/          ← Page-level React components
│   │   ├── components/     ← Reusable UI (shadcn/ui + custom)
│   │   ├── hooks/          ← Custom hooks (useAccount, useMobile, etc.)
│   │   ├── contexts/       ← React contexts (ThemeContext)
│   │   ├── lib/trpc.ts     ← tRPC client binding
│   │   ├── const.ts        ← Frontend constants (getLoginUrl, etc.)
│   │   └── App.tsx         ← Routes + providers
│   └── index.html
├── server/
│   ├── _core/              ← ⛔ DO NOT TOUCH (platform infrastructure)
│   ├── routers.ts          ← Main tRPC router (aggregates all feature routers)
│   ├── mlbRouter.ts        ← All MLB data procedures
│   ├── db.ts               ← Drizzle query helpers
│   ├── storage.ts          ← S3 file storage helpers
│   ├── services/
│   │   ├── mlbData.ts      ← External API integrations (MLB, Odds, Weather)
│   │   ├── predictionEngine.ts  ← ML pick model + edge scoring
│   │   └── cache.ts        ← In-memory TTL cache
│   ├── stripe/
│   │   ├── products.ts     ← Stripe price IDs + tier config
│   │   ├── stripeRouter.ts ← tRPC Stripe procedures
│   │   └── webhookHandler.ts   ← Stripe webhook event processor
│   └── scheduled/
│       └── refreshHandler.ts   ← Cron job: pre-warms cache + snapshots odds
├── drizzle/
│   ├── schema.ts           ← All database table definitions
│   ├── relations.ts        ← Drizzle relations
│   └── meta/               ← Migration journal
├── shared/
│   ├── const.ts            ← Shared constants (COOKIE_NAME, etc.)
│   └── types.ts            ← Shared TypeScript types
└── AGENTS.md               ← This file
```

---

## ⛔ DO NOT TOUCH: `server/_core/`

This directory is **platform infrastructure** managed by Manus. It contains OAuth, session cookies, tRPC context, Vite bridge, LLM helpers, and environment injection. Editing it can break auth, sessions, or the entire server.

Files you must never edit:
- `server/_core/index.ts` — Express server entry point
- `server/_core/oauth.ts` — OAuth callback + cross-domain handoff
- `server/_core/sdk.ts` — Manus OAuth SDK
- `server/_core/context.ts` — tRPC request context
- `server/_core/cookies.ts` — Session cookie helpers
- `server/_core/trpc.ts` — tRPC base procedures (`publicProcedure`, `protectedProcedure`)
- `server/_core/env.ts` — Environment variable access

---

## Adding a New Feature (Standard Workflow)

1. **Schema change?** Edit `drizzle/schema.ts`, run `pnpm drizzle-kit generate` to produce SQL, then apply via the Manus `webdev_execute_sql` tool (not `db:push` in production).
2. **New query helper?** Add it to `server/db.ts`.
3. **New tRPC procedure?** Add to `server/mlbRouter.ts` (MLB data) or create a new router file and register it in `server/routers.ts`.
4. **New page?** Create `client/src/pages/FeatureName.tsx`, register the route in `client/src/App.tsx`.
5. **Write tests.** Add to `server/*.test.ts`. All 16 existing tests must still pass.
6. **Type-check.** Run `pnpm check` — zero errors required.

---

## tRPC Procedure Naming

All procedures are accessed as `trpc.<router>.<procedure>` on the frontend.

| Router | Procedures |
|--------|-----------|
| `auth` | `me`, `myAccount`, `logout` |
| `mlb` | `getTodaysGames`, `getTopPicks`, `getPlayerProps`, `getTeamStats`, `getBacktestResults`, `getOddsHistory`, `getLineMovement`, `seedTeams`, `seedTeamStats`, `seedBacktestData` |
| `stripe` | `getSubscription`, `createCheckout`, `createPortalSession`, `getPricing` |
| `system` | `notifyOwner` |

---

## Subscription Tiers & Access Control

Three tiers: `free` → `pro` → `sharp`. Tier rank is numeric (0/1/2).

| Tier | Price | Access |
|------|-------|--------|
| Free | $0 | 1 pick title only, rest blurred |
| Pro | $9.99 first month → $29/mo | All picks, props, stats, analytics |
| Sharp | FREE 3-day trial → $30 first month → $24.99/mo | Everything + parlay builder, moonshots, steam alerts |

**Frontend gating:** Use `<RequireTier tier="pro">` or `<RequireTier tier="sharp">` to wrap any content that requires a subscription. Located at `client/src/components/RequireTier.tsx`.

**Backend gating:** Use `protectedProcedure` for any procedure requiring login. Tier logic lives in `server/stripe/products.ts` (`TIER_GATES`, `hasAccess`, `tierRank`).

**Owner bypass:** Any user whose `openId` matches `process.env.OWNER_OPEN_ID` or whose `role` is `admin` gets automatic Sharp access with no paywall.

---

## Stripe Configuration

**Mode:** Live (production). Do not switch to test mode without updating all price IDs.

**Price IDs** (live mode, in `server/stripe/products.ts`):
- Pro intro monthly: `price_1TesF6ANxPVrfK4rjxvcl722` ($9.99)
- Pro monthly: `price_1TermVANxPVrfK4rVtxXOcVH` ($29/mo)
- Sharp intro monthly: `price_1TesHeANxPVrfK4rOY5i4ZQq` ($30 first month)
- Sharp monthly: `price_1TesRfANxPVrfK4rXIrXg57u` ($24.99/mo)

**Webhook endpoint:** `POST /api/stripe/webhook` (registered in `server/_core/index.ts` with `express.raw()` before `express.json()`).

**Promo code:** `TEST95` (95% off, live mode) — for testing real payments without full charges.

**To add a new price:** Create it in the Stripe dashboard, then update `server/stripe/products.ts`. Never hardcode price IDs elsewhere.

---

## Authentication Flow

1. User clicks "Sign In" → `getLoginUrl()` in `client/src/const.ts` builds the OAuth URL with the canonical `manus.space` callback and encodes the user's current origin as `returnTo` in state.
2. Manus OAuth redirects to `https://mlbedge-fnjyc4zg.manus.space/api/oauth/callback`.
3. Callback issues a one-time handoff token and redirects to `https://intelligentbettingmlbedgepicks.com/api/oauth/handoff`.
4. Handoff endpoint validates the token and sets the session cookie on the custom domain.
5. Frontend reads auth state via `trpc.auth.myAccount.useQuery()` — never manipulate cookies directly.

**Do not change the OAuth flow.** It is carefully engineered to work across two domains.

---

## Data Pipeline

All external data is fetched in `server/services/mlbData.ts`:

| Source | What it provides |
|--------|-----------------|
| MLB Stats API (free) | Today's schedule, team records, probable pitchers, live scores |
| The Odds API | Money line, run line, totals, player props from 10+ books |
| OpenWeather API | Real-time ballpark weather (temp, wind speed/direction, humidity) |
| Baseball Savant | Statcast metrics (exit velo, xBA, barrel%, sprint speed) |
| Built-in `STADIUM_DATA` | Park factors, altitude, surface, coordinates for all 30 stadiums |
| Built-in `UMPIRE_DATA` | Historical umpire tendencies (K%, BB%, zone size, over%) |

**Cache:** `server/services/cache.ts` provides a TTL in-memory cache. Cold fetch ~2.9s, warm ~4ms. Fails soft (serves stale data if upstream errors).

**Scheduled refresh:** `POST /api/scheduled/refresh` is called by a Manus cron job. It invalidates the cache, pre-warms games/picks, and snapshots live odds for line-movement history.

---

## Database Schema (Key Tables)

| Table | Purpose |
|-------|---------|
| `users` | Auth + Stripe subscription state |
| `mlb_games` | Game schedule + live scores |
| `team_stats` | Season-level offensive/defensive stats per team |
| `pitcher_stats` | Per-pitcher ERA, FIP, xFIP, Statcast, splits |
| `predictions` | Model picks with edge scores + outcome tracking |
| `player_props` | Player prop picks with lines and projections |
| `odds_snapshots` | Historical odds snapshots for line movement |
| `weather_cache` | Cached ballpark weather per game |
| `umpire_tendencies` | Umpire historical tendencies |
| `backtest_results` | Historical model performance by market/tier |

All timestamps are stored as UTC. Display in user's local timezone with `new Date(utcMs).toLocaleString()`.

---

## Database Migrations

**Never run `db:push` against production.** The correct workflow:

1. Edit `drizzle/schema.ts`
2. Run `pnpm drizzle-kit generate` to produce a `.sql` migration file
3. Read the generated SQL
4. Apply it via the Manus `webdev_execute_sql` tool
5. Verify the schema change in the Manus Database panel

---

## Tests

Test files live in `server/*.test.ts`. Run with `pnpm test`.

| File | What it tests |
|------|--------------|
| `server/mlb.test.ts` | Prediction engine logic, odds math, edge scoring, park/weather adjustments |
| `server/auth.logout.test.ts` | Auth logout mutation |
| `server/openweather.test.ts` | OpenWeather API connectivity (live network call) |
| `server/oddsApi.test.ts` | The Odds API connectivity (live network call) |

All 16 tests must pass before any PR or checkpoint. Network tests are resilient to timeouts.

---

## Environment Variables

All secrets are injected by the Manus platform. Never hardcode them or commit `.env` files.

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | MySQL/TiDB connection string |
| `JWT_SECRET` | Session cookie signing |
| `STRIPE_SECRET_KEY` | Stripe live secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature verification |
| `ODDS_API_KEY` | The Odds API key |
| `OPENWEATHER_API_KEY` | OpenWeather API key |
| `OWNER_OPEN_ID` | Owner's Manus OpenID (gets auto-Sharp access) |
| `VITE_APP_ID` | Manus OAuth app ID |
| `OAUTH_SERVER_URL` | Manus OAuth backend URL |

---

## Frontend Conventions

- **Routing:** Wouter (`useLocation`, `useRoute`, `<Link>`, `<Route>`). Routes defined in `client/src/App.tsx`.
- **Auth state:** Always use `useAccount()` hook from `client/src/hooks/useAccount.ts`. Never read cookies directly.
- **API calls:** Always use `trpc.*.useQuery()` / `trpc.*.useMutation()`. Never use `fetch` or Axios.
- **Styling:** Tailwind 4 utility classes. Global theme tokens in `client/src/index.css`. Dark theme by default.
- **Components:** shadcn/ui components in `client/src/components/ui/`. Use them before building custom ones.
- **Images/media:** Never store in `client/public/` or `client/src/assets/`. Upload via `manus-upload-file --webdev` and use the returned URL.
- **Timestamps:** Store UTC, display local via `new Date(utcMs).toLocaleString()`.

---

## What NOT to Build (Deferred / Out of Scope)

- **Retrosheet historical data import** — GBs of play-by-play data, needs a real data pipeline. Not a Node-only Cloud Run task.
- **Action Network line movement** — No public API; scraping is a ToS/legal risk for a paid product. The app's own odds-snapshot system already provides line movement.
- **Manus branding** — Do not add any Manus branding or disclosure visible to end users.
- **Test card numbers** — Do not add `4242 4242 4242 4242` or any test card to any user-facing page.

---

## Pinned Next Features

1. **Contact Support to Cancel** — Add a "Contact Support to Cancel" button on `/billing` page before the self-serve cancel link. Adds friction and reduces churn.
2. **Tip Jar** — One-time Stripe payment option for users who want to support the platform beyond their subscription.

---

## Key Design Decisions

- **Cross-domain OAuth:** The app runs on two domains. The canonical `manus.space` URL is always used for OAuth redirect (it's registered with the OAuth server). A one-time handoff token bridges the session to the custom domain. Do not change this.
- **Stripe intro pricing:** Pro uses a separate intro price ID for the first month ($9.99), then switches to the regular monthly price ($29). Sharp uses a 3-day free trial then an intro price ($30), then regular ($24.99). This is handled in `stripeRouter.ts` via `phases` in the subscription schedule.
- **In-memory cache:** The prediction engine is CPU-light but the external API calls (MLB schedule, odds, weather) add up to ~2.9s cold. The TTL cache makes warm requests ~4ms. The scheduled refresh job keeps the cache warm in production.
- **Free tier is a teaser only:** Free users see exactly 1 pick title with no analysis. Everything else is blurred behind a paywall overlay. This is intentional and must be preserved.
