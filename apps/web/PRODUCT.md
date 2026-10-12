# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: the curious general reader — Azerbaijanis at home and in the diaspora (and Russian- or English-speaking readers) who want to rediscover the classics. They arrive from search or a shared link, often on a phone, and want the text of a specific poem plus a translation they can actually understand.

Secondary, served without being the default: students and teachers who need reliable texts and author context; philologists and translators comparing originals against translations; contributors submitting texts and translations; editors reviewing them in the admin.

## Product Purpose

IRS.AZ is a non-commercial portal for Azerbaijani literary and cultural heritage — poets, writers, philosophers and their works — in the spirit of культура.рф but focused on literature. Every work has its own URL; collections (divans, masnavis) are read in order with prev/next navigation. Success is a reader landing on a poem, reading it in the original alongside a translation, and continuing to the next work or the author.

## Positioning

- **Parallel originals and translations.** One page per work with the original (mostly Persian, some Azerbaijani) beside AZ / RU / EN translations, transliterations and modernizations. Wikisource, Ganjoor and Wikipedia each hold a fragment; none present Azerbaijani classics this way.
- **Curated reading experience.** Editorially shaped and made for reading, not a raw wiki dump.
- **Community contributions.** Philologists, translators, teachers and students submit authors, works and translations through a reviewed queue.
- **Azerbaijani-first framing.** Persian-language poets (Nizami, Fuzuli, Xaqani, Mahsati) are presented within Azerbaijani heritage, with Azerbaijani as the default UI language.

## Operating Context

- UI languages: az (default), ru, en via `/az`, `/ru`, `/en`. There is no Persian UI locale; Persian appears as content.
- Public surfaces: home (poet of the week, poem of the day, themes, centuries and forms, a section catalogue with real counts, recent additions), author index and profiles (with manuscript pages and miniatures), works index, the reading page, collection tables of contents, theme tag pages (`/tags`, `/tags/<tag>/muellif-<author>`), blog, search (Meilisearch).
- Filter pages have readable Azerbaijani URLs in every UI language (`/az/works/muellif-fuzuli/forma-qezel`, `/az/authors/sairler/esr-12`); the vocabulary lives in `apps/web/lib/facets.ts` and is public, so values are never renamed in place.
- The reading page ends with share (Telegram, WhatsApp, Facebook, copy link, the device share sheet) and print, more by the author, and other poets' poems on the same theme. Texts over 40 lines open folded.
- Admin: editors manage authors, works, collections, translations and blog posts, review submissions, and confirm, remove or bulk-assign theme tags (school use, "Məktəb üçün", is assigned only by hand). Roles: SUPERADMIN, EDITOR, CONTRIBUTOR, READER. Registration is public; contributors and above can submit.
- Theme, mood, audience and era tags are first assigned by keyword rules (`packages/parser` `tag-works`); an editor's confirmation or removal is kept when the rules run again.
- The corpus is imported by `packages/parser` from az/ru Wikisource, Wikipedia (author bios) and Ganjoor, then edited.
- The project is a solo build (code, design, content), with a collaborator handling community, partnerships, social media and a Telegram channel.

## Capabilities and Constraints

- Work bodies are stored as Markdown and pre-rendered to `bodyHtml`. A work carries `scriptDirection` (LTR/RTL), genre (poem, prose, play, essay, philosophy, letter, memoir) and form (ghazal, masnavi, rubai, qasida, murabba, free verse).
- Translation types: translation, transliteration, modernization. A work can have several translations per language (different translators); `isDefault` marks the one shown first, and readers switch versions on the reading page (`?tr=<id>`). Translation bodies are Markdown, pre-rendered to `bodyHtml` like works.
- Content languages: AZ (Latin, Arabic, Cyrillic scripts), FA, AR, RU, EN, TR.
- **Non-commercial.** No ads, paywalls, monetization surfaces or tracking-heavy features.
- **Source attribution is required.** Every text and translation shows its source (e.g. Wikisource, Ganjoor) and its translator. Licensing must be visible.
- **Persian RTL is first-class.** Persian originals are most of the corpus (3,181 of 5,047 published works in October 2026), so RTL rendering must be as good as LTR.
- Planned deployment at irs.az: one VPS, Docker Compose, Caddy, Cloudflare (`deploy/README.md`); CI builds images on every push to `main` and deploys once the server is configured. Until then the site is shown from a laptop through a temporary Cloudflare quick tunnel (`deploy/tunnel`).

## Brand Commitments

- Name: **IRS.AZ**. Tagline: "Poets · Writers · Philosophers · Works · Translations".
- Two reader-selectable skins on shared markup, switched from the header and remembered per reader, each in light and dark (both recorded in `DESIGN.md`):
  - **Gazette (the default):** a newspaper / literary gazette aesthetic, user-stated in the project's CLAUDE.md. Ivory, ink-black and pomegranate red, Molla Nasraddin ornamental accents (◆ diamonds, double rules).
  - **Clean (the approved alternative):** modelled on culture.ru at the user's request: white pages, one charcoal header bar, grey cards and pills, one crimson, PT Sans and PT Serif, no rules or ornaments. Its refusal of the gazette's ornament is deliberate, not drift.
- Theme: the visitor's OS setting until they choose; a choice is remembered.

## Evidence on Hand

- In October 2026: 5,047 published works (5,140 in all) by 12 authors with works (Xaqani, Fuzuli, Nasimi, Mahsati, Nizami, Xətai, Vaqif, Sabir, Axundzadə, Cavid, Cabbarlı, Vurğun) across 92 collections; 113 published translations (112 English, 1 Russian); 754 manuscript pages and miniatures; 25 tags. Seed data covers Fuzuli, Nizami and Nasimi.
- No logo artwork. Only favicons exist in `public/`.
- No user counts, testimonials, partner institutions or press exist. Never fabricate them.

## Product Principles

1. **The text comes first.** The reading page is the product; everything else routes readers to a work or the next one.
2. **Original and translation together.** Never hide the original to show the translation, or the reverse.
3. **Every text has a provenance.** Source and translator are always visible; trust is earned by attribution.
4. **Both scripts are equal.** RTL Persian and LTR Azerbaijani, Russian and English get equal typographic care.
5. **Heritage without commerce.** Nothing on the page asks the reader for anything except to keep reading or to contribute.

## Accessibility & Inclusion

WCAG 2.1 AA is the floor: contrast, full keyboard operation and screen-reader support, plus correct `lang` and `dir` on mixed-language and mixed-direction content.
