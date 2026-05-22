# RustyGate Forum

Invite-only urban exploration community forum with a dark industrial UI, full thread/category system, invite redemption with community guidelines acceptance, crew rooms, chat, and private messages.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied at /api)
- `pnpm --filter @workspace/hidden-freeways run dev` — run the forum frontend (port 19571, proxied at /)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL`, `SESSION_SECRET`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite + Tailwind CSS (retro phpBB theme)
- API: Express 5 with express-session + connect-pg-simple
- DB: PostgreSQL + Drizzle ORM
- Auth: bcryptjs password hashing, session-based auth
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/api-server/src/routes/` — all API routes (auth, categories, threads, posts, chat, crews, etc.)
- `artifacts/api-server/src/lib/` — auth middleware, excerpt helpers, logger
- `artifacts/api-server/src/utils/http.ts` — `requireString` helper
- `artifacts/hidden-freeways/src/pages/` — all page components
- `artifacts/hidden-freeways/src/components/layout.tsx` — retro phpBB navbar/header/footer
- `artifacts/hidden-freeways/src/index.css` — retro forum color scheme + phpBB-style classes
- `lib/db/src/schema/` — all Drizzle table definitions
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth)
- `lib/api-zod/src/generated/` — generated Zod schemas (from codegen)
- `lib/api-client-react/src/generated/` — generated React Query hooks (from codegen)

## Architecture decisions

- Invite-only: all routes require authentication except `/login`, `/invite`, and `/invite/:code`
- Registration flow: invite code → read & accept community guidelines → choose username/password
- Session stored in PostgreSQL via `connect-pg-simple` (table: `sessions_pg`)
- Retro phpBB styling done entirely with inline styles and custom CSS classes (no Tailwind for the forum chrome)
- Categories support parent/child hierarchy for sub-forums

## Product

- Forum home with collapsible category sections, per-category thread/post counts and latest post info
- Thread list per category with pinned/locked indicators
- Thread detail with BBCode rendering, post votes, inline editing for authors/admins
- Invite system: 3-step flow (enter code → read community guidelines → create account)
- Chat rooms by state/location + crew-private rooms
- Private messages between members
- Crew system: create/join crews with private chat rooms
- Geographic sector browsing (US states with location counts)
- Admin panel: manage users, categories, invites, announcements, site settings
- Online members list + real-time presence

## User preferences

- Retro phpBB/vBulletin visual style (grey background, dark blue header/nav, white content boxes, orange accents)
- Invite-only registration with community guidelines acceptance required
- Underground/opsec-focused community rules

## Gotchas

- SESSION_SECRET must be set as an environment variable
- DB schema push required after adding new tables: `pnpm --filter @workspace/db run push`
- After changing OpenAPI spec: run codegen before restarting workflows
- Admin bootstrap credentials: username `TWHY`, password `Qzz908kasr15`
- Initial invite code seeded: `WELCOME2025`

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
