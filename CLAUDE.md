# IRS.AZ — Azerbaijani Cultural Heritage Portal

## Project structure
- **Monorepo** with pnpm workspaces
- `apps/api` — NestJS backend (port 4000)
- `apps/web` — Next.js 15 frontend (port 3000)
- `packages/shared` — Shared types and constants

## Commands
```bash
pnpm install                    # install all deps
pnpm services:up                # start Postgres (:5433) + Meilisearch (:7700) via docker compose
pnpm services:down              # stop them (data kept in named volumes)
pnpm dev                        # run both api + web in parallel
pnpm dev:api                    # run backend only
pnpm dev:web                    # run frontend only
pnpm db:generate                # prisma generate
pnpm db:migrate                 # prisma migrate dev
pnpm db:seed                    # seed database
pnpm build                      # build everything
```

## Stack
- **Backend**: NestJS 11, Prisma 6, PostgreSQL, Meilisearch, JWT auth
- **Frontend**: Next.js 15 (App Router), next-intl, React 19
- **Languages**: TypeScript throughout

## Key architecture decisions
- **Reading page** is the core experience — every work/poem has its own URL with prev/next navigation within collections
- **Parallel text** — works have translations (AZ, RU, FA, EN) rendered side-by-side or stacked
- **Markdown** for work body storage, rendered to HTML and cached in `bodyHtml`
- **`@@index([collectionId, order])`** on Work — the compound index powers prev/next queries
- **Translations**: several per language are allowed (different translators); `isDefault` marks the one shown first per work + language, and the first one added becomes the default. The reading page switches versions via `?tr=<id>`
- **Submissions** use a single table with JSON payload, type-discriminated
- **Work slugs** are readable (`fuzuli-qezel-7`). `Work.sourceId` is the stable import key (e.g. `ganjoor-116713`); renamed slugs go into `previousSlugs` and old URLs 308-redirect (middleware for legacy slugs, page fallback otherwise)

## i18n
- Three UI languages: az (default), ru, en
- next-intl for frontend routing: `/az/...`, `/ru/...`, `/en/...`
- Message files in `apps/web/messages/`

## Design
- Newspaper/literary gazette aesthetic — ivory, ink-black, pomegranate red
- Molla Nasraddin ornamental accents (◆ diamonds, double rules)
- Light/dark theme via CSS variables on `[data-theme]`
