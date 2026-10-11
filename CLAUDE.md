# IRS.AZ — Azerbaijani Cultural Heritage Portal

## Project structure
- **Monorepo** with pnpm workspaces
- `apps/api` — NestJS backend (port 4000)
- `apps/web` — Next.js 15 frontend (port 3000)
- `packages/shared` — Shared types and constants

## Commands
```bash
pnpm install                    # install all deps
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
- **`@@unique([workId, language, type])`** on Translation — prevents duplicates
- **Submissions** use a single table with JSON payload, type-discriminated

## i18n
- Three UI languages: az (default), ru, en
- next-intl for frontend routing: `/az/...`, `/ru/...`, `/en/...`
- Message files in `apps/web/messages/`

## Design
- Newspaper/literary gazette aesthetic — ivory, ink-black, pomegranate red
- Molla Nasraddin ornamental accents (◆ diamonds, double rules)
- Light/dark theme via CSS variables on `[data-theme]`
