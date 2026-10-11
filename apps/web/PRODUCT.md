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
- Public surfaces: home (poet of the week, authors, works by century and genre, recent additions), author index and profiles, works index, the reading page, collection tables of contents, blog, search (Meilisearch).
- Admin: editors manage authors, works, collections, translations and blog posts and review submissions. Roles: SUPERADMIN, EDITOR, CONTRIBUTOR, READER. Registration is public; contributors and above can submit.
- The corpus is imported by `packages/parser` from az/ru Wikisource, Wikipedia (author bios) and Ganjoor, then edited.
- The project is a solo build (code, design, content), with a collaborator handling community, partnerships, social media and a Telegram channel.

## Capabilities and Constraints

- Work bodies are stored as Markdown and pre-rendered to `bodyHtml`. A work carries `scriptDirection` (LTR/RTL), genre (poem, prose, play, essay, philosophy, letter, memoir) and form (ghazal, masnavi, rubai, qasida, murabba, free verse).
- Translation types: translation, transliteration, modernization. There is one per work/language/type.
- Content languages: AZ (Latin, Arabic, Cyrillic scripts), FA, AR, RU, EN, TR.
- **Non-commercial.** No ads, paywalls, monetization surfaces or tracking-heavy features.
- **Source attribution is required.** Every text and translation shows its source (e.g. Wikisource, Ganjoor) and its translator. Licensing must be visible.
- **Persian RTL is first-class.** About 98% of the imported corpus is Persian originals, so RTL rendering must be as good as LTR.
- Deployed at irs.az: one VPS, Docker Compose, Caddy, Cloudflare.

## Brand Commitments

- Name: **IRS.AZ**. Tagline: "Poets · Writers · Philosophers · Works · Translations".
- Binding visual reference (user-stated in the project's CLAUDE.md): a newspaper / literary gazette aesthetic. Ivory, ink-black and pomegranate red. Molla Nasraddin ornamental accents (◆ diamonds, double rules). Light and dark themes.

## Evidence on Hand

- About 3,259 imported work files across 6 authors with works (Xaqani, Fuzuli, Nasimi, Mahsati, Nizami, Vaqif), 13 author profiles and 26 collections. Seed data covers Fuzuli, Nizami and Nasimi.
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
