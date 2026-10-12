# IRS.AZ

An online library of Azerbaijani literature and cultural heritage: classical and modern poetry, translations, manuscript pages and miniatures.

Every work has its own reading page, with prev/next navigation through its collection. Translations (Azerbaijani, Russian, Persian, English) can be read side by side with the original. The interface is available in Azerbaijani, Russian and English.

## Stack

pnpm monorepo, TypeScript throughout.

| Path | What it is |
|---|---|
| `apps/web` | Next.js 15 frontend (App Router, next-intl), port 3000 |
| `apps/api` | NestJS 11 API with Prisma, PostgreSQL and Meilisearch, port 4000 |
| `packages/parser` | Scrapers and the importer that loads `packages/parser/data` into the database |
| `packages/shared` | Shared types and constants |
| `deploy` | Docker Compose production setup ([deploy/README.md](deploy/README.md)) |

## Getting started

Requires Node 20+, pnpm and Docker.

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

pnpm services:up      # Postgres on :5433, Meilisearch on :7700
pnpm db:migrate
pnpm db:seed          # admin user and a few sample works
pnpm parse:import --publish   # the full library from packages/parser/data

pnpm dev              # web on http://localhost:3000, API on :4000
```

`db:seed` creates the `admin@irs.az` user. Set `SEED_ADMIN_PASSWORD` to choose its password, otherwise one is generated and printed. Without `--publish`, imported records stay drafts and only show up in the admin.

## Data

The texts come from Ganjoor, Azerbaijani Wikisource and public-domain English translations. Artwork metadata comes from the Met Museum's Open Access collection. [packages/parser/data/README.md](packages/parser/data/README.md) lists the sources and their terms.

## License

The code is [MIT](LICENSE). The texts and metadata in `packages/parser/data` are not covered by it; each keeps its source's rights.
