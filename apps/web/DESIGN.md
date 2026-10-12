---
name: IRS.AZ
description: Azerbaijani literary heritage, read in the original beside its translation. Two reader-selectable skins on one markup.
colors:
  gazette-ivory: "#F4EFE6"
  gazette-ink: "#1C1916"
  gazette-pomegranate: "#8E1515"
  gazette-pomegranate-deep: "#6A1010"
  gazette-muted: "#6B5E52"
  gazette-rule: "#A89070"
  gazette-control: "#8A7458"
  gazette-surface: "#D9CCBA"
  gazette-highlight: "#F0E4E4"
  gazette-dark-bg: "#1A1410"
  gazette-dark-ink: "#E8E0D4"
  gazette-dark-pomegranate: "#D96B6B"
  gazette-dark-fill: "#A63A3A"
  gazette-dark-muted: "#A39384"
  gazette-dark-rule: "#4A3A2C"
  gazette-dark-surface: "#302619"
  clean-white: "#FFFFFF"
  clean-page: "#EFEEEC"
  clean-ink: "#232427"
  clean-muted: "#5F5D58"
  clean-grey: "#E4E2DF"
  clean-grey-deep: "#D9D7D3"
  clean-hairline: "#DCDAD6"
  clean-control: "#86837D"
  clean-highlight: "#FBE7EA"
  clean-crimson: "#C8102E"
  clean-crimson-deep: "#A30D25"
  clean-charcoal: "#2D2C2A"
  clean-header-muted: "#B7B4AE"
  clean-header-accent: "#FF5A5F"
  clean-dark-bg: "#1A1917"
  clean-dark-ink: "#EAE8E4"
  clean-dark-muted: "#A29F99"
  clean-dark-grey: "#252421"
  clean-dark-grey-deep: "#2F2E2B"
  clean-dark-red: "#FF6B6E"
  clean-dark-header: "#100F0E"
typography:
  gazette-featured:
    fontFamily: "Cormorant Garamond, Source Serif 4, Georgia, serif"
    fontSize: "3.5rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.03em"
  gazette-display:
    fontFamily: "Cormorant Garamond, Source Serif 4, Georgia, serif"
    fontSize: "3rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.03em"
  gazette-masthead:
    fontFamily: "Cormorant Garamond, Source Serif 4, Georgia, serif"
    fontSize: "1.95rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.03em"
  gazette-headline:
    fontFamily: "Cormorant Garamond, Source Serif 4, Georgia, serif"
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  gazette-title:
    fontFamily: "Cormorant Garamond, Source Serif 4, Georgia, serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  gazette-body:
    fontFamily: "Source Serif 4, Georgia, Times New Roman, serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.8
  gazette-reading:
    fontFamily: "Source Serif 4, Georgia, Times New Roman, serif"
    fontSize: "1.05rem"
    fontWeight: 400
    lineHeight: 1.95
  gazette-label:
    fontFamily: "Alegreya Sans, Source Serif 4, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "0.12em"
  gazette-caption:
    fontFamily: "Alegreya Sans, Source Serif 4, system-ui, sans-serif"
    fontSize: "0.7rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0.12em"
  gazette-arabic:
    fontFamily: "Amiri, Noto Naskh Arabic, Geeza Pro, serif"
    fontSize: "1.26rem"
    fontWeight: 400
    lineHeight: 2.05
  clean-display:
    fontFamily: "Noto Sans, Helvetica Neue, Arial, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  clean-headline:
    fontFamily: "Noto Sans, Helvetica Neue, Arial, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  clean-title:
    fontFamily: "Noto Sans, Helvetica Neue, Arial, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.25
  clean-body:
    fontFamily: "Literata, Georgia, serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  clean-reading:
    fontFamily: "Literata, Georgia, serif"
    fontSize: "1.05rem"
    fontWeight: 400
    lineHeight: 1.8
  clean-label:
    fontFamily: "Noto Sans, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "0"
  clean-nav:
    fontFamily: "Noto Sans, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.78rem"
    fontWeight: 700
    letterSpacing: "0.06em"
  clean-arabic:
    fontFamily: "Noto Naskh Arabic, Amiri, Geeza Pro, serif"
    fontSize: "1.26rem"
    fontWeight: 400
    lineHeight: 2.1
  reading-literary:
    fontFamily: "Alegreya, Source Serif 4, Georgia, serif"
    fontSize: "1.05rem"
    fontWeight: 400
    lineHeight: 1.95
rounded:
  gazette: "4px"
  clean-control: "10px"
  clean-card: "16px"
  clean-feature: "20px"
  pill: "999px"
spacing:
  xs: "0.5rem"
  sm: "1rem"
  md: "1.5rem"
  lg: "2.5rem"
  xl: "3.5rem"
  reading-measure: "36rem"
  verse-measure: "48rem"
  parallel-measure: "64rem"
  container: "72rem"
components:
  gazette-button-primary:
    backgroundColor: "{colors.gazette-pomegranate}"
    textColor: "{colors.gazette-ivory}"
    rounded: "{rounded.gazette}"
    padding: "0.4rem 0.9rem"
  gazette-button-primary-hover:
    backgroundColor: "{colors.gazette-pomegranate-deep}"
  gazette-pill:
    backgroundColor: "{colors.gazette-surface}"
    textColor: "{colors.gazette-ink}"
    rounded: "{rounded.gazette}"
  gazette-pill-active:
    backgroundColor: "{colors.gazette-pomegranate}"
    textColor: "{colors.gazette-ivory}"
  gazette-card:
    backgroundColor: "{colors.gazette-ivory}"
    textColor: "{colors.gazette-ink}"
    padding: "1rem"
  gazette-card-hover:
    backgroundColor: "{colors.gazette-surface}"
  clean-header:
    backgroundColor: "{colors.clean-charcoal}"
    textColor: "{colors.clean-white}"
    typography: "{typography.clean-nav}"
    padding: "0.85rem 1.5rem"
  clean-button-primary:
    backgroundColor: "{colors.clean-crimson}"
    textColor: "{colors.clean-white}"
    rounded: "{rounded.clean-control}"
    padding: "0.55rem 1.1rem"
  clean-button-primary-hover:
    backgroundColor: "{colors.clean-crimson-deep}"
  clean-button:
    backgroundColor: "{colors.clean-grey}"
    textColor: "{colors.clean-ink}"
    rounded: "{rounded.clean-control}"
    padding: "0.55rem 1.1rem"
  clean-pill:
    backgroundColor: "{colors.clean-grey}"
    textColor: "{colors.clean-ink}"
    rounded: "{rounded.pill}"
    padding: "0.35rem 0.9rem"
  clean-pill-hover:
    backgroundColor: "{colors.clean-grey-deep}"
  clean-pill-active:
    backgroundColor: "{colors.clean-crimson}"
    textColor: "{colors.clean-white}"
  clean-card:
    backgroundColor: "{colors.clean-grey}"
    textColor: "{colors.clean-ink}"
    rounded: "{rounded.clean-card}"
    padding: "1.25rem 1.5rem"
  clean-card-hover:
    backgroundColor: "{colors.clean-grey-deep}"
  clean-catalog-tile-works:
    backgroundColor: "{colors.clean-crimson}"
    textColor: "{colors.clean-white}"
    rounded: "{rounded.clean-card}"
    padding: "1.25rem 1.5rem"
  clean-icon-button:
    backgroundColor: "{colors.clean-grey}"
    textColor: "{colors.clean-ink}"
    rounded: "{rounded.pill}"
    size: "2.5rem"
---

# Design System: IRS.AZ

## Overview

**Creative North Star: "One Reading Room, Two Editions"**

IRS.AZ is one reading room printed in two editions. The markup, the reading page and the verse layout are shared; a reader picks the edition from a header toggle (stored in `localStorage.skin`, applied as `html[data-skin='clean']` before first paint, so it never flashes). Each edition has a light and a dark theme (`data-theme`, also set before paint, defaulting to the OS preference). The **Gazette** is the default and the incumbent: a Molla Nasraddin–era literary newspaper on ivory, set in Cormorant Garamond and Source Serif, with pomegranate ink, ◆ ornaments, double rules and tracked small capitals. The **Clean** edition is the alternative: a museum-portal reading room in culture.ru's grammar. It uses warm grey pages, one charcoal header bar, soft grey cards and pills, and a single crimson. It is set in Noto Sans and Literata, with no rules and no ornaments.

Both editions serve the same priority: the text comes first. A poem is set large in a serif at a comfortable measure, the original sits beside its translation, Persian is set right to left in a real Naskh face with taller leading, and provenance sits under every text. Density is low on the reading page and moderate on indexes. Neither edition carries commercial surfaces.

The two editions are distinct worlds, not a theme and its variant. Gazette devices (◆, double rules, ivory, tracked caps, pomegranate labels) never appear in Clean. Clean devices (grey cards, 999px pills, round icon buttons, the full-width grey band) are not added to the Gazette.

**Key Characteristics:**
- Shared markup, two skins: all Clean overrides live under `[data-skin='clean']` in `styles/skin-clean.css`, and the Gazette lives in `styles/globals.css`.
- Light and dark in both skins, driven by the same custom-property names (`--bg`, `--ink`, `--muted`, `--surf`, `--pomeg`, `--pomeg-fill`, `--rule`, `--control`).
- Serif reading text in both skins: Source Serif 4 (Gazette), Literata (Clean).
- Persian/Arabic-script text always switches to a Naskh face, at 1.2× size with taller leading.
- Flat surfaces. Only the reading-appearance popover casts a shadow.
- Icons are inline SVG at 18px with 1.6–1.8 strokes.

**The Shared Markup Rule.** A new component ships one markup and two stylings: the Gazette in `globals.css` and the Clean override in `skin-clean.css`, scoped to `[data-skin='clean']`. A component that only looks right in one skin is unfinished.

## Colors

The Gazette is ink and pomegranate on warm paper. Clean is charcoal ink on white with grey surfaces and one crimson. Both resolve through the same custom properties, so a component written against `--pomeg` or `--surf` is correct in all four skin and theme combinations.

### Primary
- **Pomegranate Ink** (gazette-pomegranate): the Gazette's only colour. It covers section heads, ◆ ornaments, double rules, active pills and tabs, links in provenance, the breadcrumb's current page and the logo. **Pomegranate Deep** (gazette-pomegranate-deep) is its hover state. In dark theme the text colour lifts to gazette-dark-pomegranate and filled states use gazette-dark-fill, so white text on them stays legible.
- **Clean Crimson** (clean-crimson): the Clean skin's only accent. It fills active pills, active language and translation tabs, the primary and search buttons, the active language in the header and the "Works" catalogue tile. It is also the colour of link text (the glossary toggle, "Read on" and "Random" links) and of numbers and titles on hover. It measures 5.9:1 on white, and white on crimson measures 5.9:1. **Crimson Deep** (clean-crimson-deep) is its hover fill. In dark theme crimson text lifts to clean-dark-red (6.4:1), while fills stay crimson.
- **Header Crimson** (clean-header-accent): the same crimson, lifted for the charcoal bar. It marks the current section's 2px underline and the "AZ" in the wordmark, and appears only in the header.

### Neutral
- **Gazette Ivory** (gazette-ivory) and **Gazette Ink** (gazette-ink): page and text. In dark theme they become a near-black brown (gazette-dark-bg) and parchment (gazette-dark-ink).
- **Gazette Muted** (gazette-muted): metadata, datelines, incipits and footer text.
- **Gazette Rule** (gazette-rule): the 0.5px hairlines between cards, rows and columns. **Gazette Control** (gazette-control) is the 1px border on interactive controls (at least 3:1 on ivory).
- **Gazette Surface** (gazette-surface): filled pills, buttons and hover backgrounds. **Gazette Highlight** (gazette-highlight) marks search hits.
- **Clean Page** (clean-page) and **Clean Ink** (clean-ink, 13.4:1): a warm grey page and its text, greyer than culture.ru's white at the user's request. Clean White is only the text on crimson. In dark theme they become clean-dark-bg and clean-dark-ink.
- **Clean Muted** (clean-muted): breadcrumbs, metadata, labels and captions. It measures 5.1:1 on white and 4.6:1 on grey. Its dark-theme counterpart, clean-dark-muted, measures 6.7:1.
- **Clean Grey** (clean-grey) and **Clean Grey Deep** (clean-grey-deep): the surface pair. Cards, pills, tiles, nav buttons and the "other poets" band use grey, and their hover state uses grey deep. The footer also uses grey deep.
- **Charcoal** (clean-charcoal): the header bar only (clean-dark-header in dark theme), with white text and nav in **Header Muted** (clean-header-muted).
- **Clean Control** (clean-control), **Clean Hairline** (clean-hairline) and **Clean Highlight** (clean-highlight): breadcrumb separators and meta dots, the rare remaining divider, and search hits.

### Named Rules
**The Pomegranate Ink Rule.** In the Gazette, pomegranate is the only colour. Everything that is not ink or paper is pomegranate, and pomegranate is never a large fill except active controls.

**The One Crimson Rule.** In Clean, crimson is the only accent. It goes on the one active choice in a group, the primary action and the Works tile. A second accent hue is never introduced. Header Crimson is the same accent, not another one.

**The Grey Surface Rule.** In Clean, things are grouped by grey surfaces and space, never by lines. A card is a grey shape, a band is a full-width grey field, and the footer is grey deep.

## Typography

**Gazette display:** Cormorant Garamond (fallback Source Serif 4, Georgia)
**Gazette text:** Source Serif 4 (fallback Georgia)
**Gazette interface:** Alegreya Sans
**Clean display and interface:** Noto Sans (fallback Helvetica Neue, Arial)
**Clean text:** Literata (fallback Georgia)
**Reader-chosen text (both skins):** Alegreya for "Literary", `system-ui` for "System"
**Persian / Arabic:** Amiri in the Gazette, Noto Naskh Arabic in Clean (each falls back to the other)

**Character:** The Gazette pairs a high-contrast Garamond display with a sturdy text serif and a humanist sans for the small print, the way a literary weekly does. Clean uses a bold sans for every heading and control, and a book serif for anything meant to be read. Every reading face must carry Ə/ə (U+018F/U+0259), the commonest Azerbaijani vowel: Clean left PT Sans and PT Serif for this reason, since they lack it and the browser filled every ə from a fallback face. All eight faces load in one Google Fonts request. A face's files download only when a skin uses it.

### Hierarchy
- **Display** (gazette-display / clean-display): page and work titles. Work titles are 2.75rem in the Gazette and 2.5rem in Clean (2rem under 768px). They are centred and balanced. A Persian title switches to the Naskh face at 700 weight with 1.5 leading.
- **Headline** (gazette-headline / clean-headline): section heads. In Clean every section head ("Other works by the author", "Catalogue", theme groups, collection names) is the 1.375rem bold sans in sentence case.
- **Title** (gazette-title / clean-title): card and list titles. Work-card titles are 1.05rem/600 in the Gazette and 1.125rem/700 in Clean.
- **Body** (gazette-body / clean-body): prose, biographies and text pages. Biographies and text pages run at 1.0625rem with 1.7–1.75 leading in Clean, with a 38–44rem measure.
- **Reading** (gazette-reading / clean-reading): the text of a work, driven by `--reading-size`, `--reading-font` and `--reading-leading` from the "Aa" appearance popover. The reader picks one of four faces for it, two by two under the label: Book (the skin's text serif, the default), Literary (Alegreya), Sans (the skin's interface sans) and System (`system-ui`: SF Pro, Segoe UI or Roboto, nothing to download). Older saved "serif" choices read as Book. Persian/Arabic reading text is 1.2× the reading size with 2.05 (Gazette) or 2.1 (Clean) leading.
- **Label**: the Gazette's labels are Alegreya Sans in tracked uppercase: gazette-label (0.75rem) for running labels and gazette-caption (0.7rem) for section heads, chips and metadata, at 0.08–0.14em tracking. Nothing is smaller; only the ◆ ornaments go below 0.7rem. The masthead (gazette-masthead) and the poet of the week (gazette-featured) are Cormorant Garamond 700, in muted or pomegranate. Clean labels (clean-label) are 0.875rem, sentence case, untracked, regular weight and muted. This covers language labels over parallel columns, "Source"/"Translator" keys, "Share" and "Previous/Next".
- **Nav** (clean-nav): Clean's header nav is the one uppercase line in that skin. It is bold, tracked 0.06em, header-muted, and white when current.

### Named Rules
**The Two Scripts Rule.** Arabic-script text (`:lang(fa)`, `:lang(ar)`, `:lang(az-Arab)`) always gets the Naskh face, 1.2× size and taller leading, with `dir="rtl"` on the element. This applies wherever it appears: reading column, card title, incipit, breadcrumb or prev/next. Persian is never set in a Latin face.

**The Sentence Case Rule.** In Clean, every label, button and section head is sentence case and untracked. The header nav is the only uppercase, a convention of the charcoal bar.

**The Department Head Rule.** In the Gazette, a section's heading is a department head: Alegreya Sans, uppercase, tracked 0.14em, pomegranate, led by a small ◆. It is the section's only heading and names the department ("Poet of the week", "Catalogue"). It is never stacked as a decorative label above another headline.

## Layout

The page is a centred column of up to 72rem with 1.5rem side padding.

**Reading measures.** A single text column is 36rem. Persian verse widens to 48rem at 60rem viewports and above, where each couplet's two hemistichs sit side by side in two centred columns with a 3.5rem gutter, as in a printed divan. A parallel original-and-translation grid is 64rem, two equal columns (2.5rem gap in the Gazette, 3.5rem in Clean). The reading toolbar (version tabs at the start, the round "Aa" at the end) matches the width of the text beneath it.

**Homepage.** The main column holds the poet of the week, with the poem of the day beneath it. A 300px sidebar (20rem in Clean) holds recent additions and theme, century and form pills. Then come the 4×2 catalogue and three recent works. In the Gazette, columns are divided by rules. In Clean they are separated by a 2.5rem gap. Under 768px everything stacks, and the catalogue goes to 2 columns.

**Card grids.** "More by this author" and "Other poets" have 4 columns, 2 below 960px and 1 below 480px.

**Rhythm.** Spacing steps are 0.5 / 1 / 1.5 / 2.5 / 3.5rem. Clean opens sections with 3.5rem and separates groups by 2.5rem. Card gutters are 1rem in Clean. Gazette cards touch, sharing collapsed 0.5px borders.

**Breakpoints.** The breakpoints are 480px (phone verse indents, single-column grids), 768px (stacking, parallel text goes single column), 960px / 60rem (side-by-side Persian couplets, 2-column card grids) and 40rem (gallery). On `pointer: coarse`, round buttons and "Read on" grow to a 2.75rem target, and the keyboard hint under prev/next is hidden.

**The Reading Measure Rule.** Text is never wider than 36rem in a single column, 48rem for Persian verse, or 64rem for parallel text. Wider layouts belong to indexes, not to reading.

## Elevation & Depth

Both skins are flat. The Gazette conveys depth with rules (0.5px hairlines, 1px control borders, 4px double rules in pomegranate) and filled surface tints. Clean conveys it with tonal steps: warm grey page, deeper grey surface, grey-deep hover, a charcoal bar. One element floats in each skin: the reading-appearance popover.

### Shadow Vocabulary
- **Gazette popover** (`box-shadow: 0 4px 16px rgba(0,0,0,0.12)`): the "Aa" appearance popover only.
- **Clean pop** (`--shadow-pop: 0 10px 32px -8px rgba(20,22,28,0.18), 0 2px 6px rgba(20,22,28,0.06)`; dark: `0 12px 36px -8px rgba(0,0,0,0.6), 0 2px 6px rgba(0,0,0,0.3)`): the same popover, borderless, at a 16px radius.

### Named Rules
**The Flat Page Rule.** Nothing on the page casts a shadow at rest or on hover. Hover is a tone change (Gazette: ink fill with paper text, or a surface tint; Clean: grey to grey deep). Shadows belong only to things that float above the page.

## Shapes

**Gazette:** nearly square. Controls use a 4px radius. Language, appearance and reader-tab segments join into connected strips with shared borders. Frames are drawn, not filled. The poet of the week sits in a 2px pomegranate frame with a 1px inner frame and a ◆ ◆ ◆ crest, and the page closes with a tailpiece (◆ between double rules). Meta dots are 3px pomegranate circles.

**Clean:** soft and separate. Chips, tabs, the language switcher's ends and "Read on" are 999px pills. Buttons, inputs, pagination squares and list hovers are 10px. Cards, tiles, prev/next and the popover are 16px. The featured poet card is 20px. Icon buttons ("Aa", share, theme, skin) and author portraits are circles. Connected strips are broken into separate pills with 0.3–0.5rem gaps. Chevrons are drawn with two 2px (or 1.5px) borders rotated 45°, never typed.

## Components

### Buttons
- **Gazette:** small Alegreya Sans (0.7rem, 0.05em tracking) on surface tint with a 1px rule border and a 4px radius. Hover inverts to an ink fill with paper text. Primary is a pomegranate fill with white text and a pomegranate-deep hover. The search button is a tracked-caps pomegranate block.
- **Clean:** bold Noto Sans at 0.85rem, borderless, 10px radius, `0.55rem 1.1rem`. The default is grey with a grey-deep hover. Primary and search are crimson with white text and a crimson-deep hover.
- **Read on (unfold):** in the Gazette a tracked-caps bordered button, in Clean a grey 999px pill in sentence case (0.9rem bold), with crimson text on hover.
- **Focus:** both skins use a 2px `--pomeg` outline with a 2px offset (6px radius in Clean, white inside the charcoal header).

### Chips
- **Pills** (filters, tag pills, centuries, forms, pagination): in the Gazette they are 4px-radius tinted rectangles with a hairline border, inverting to pomegranate on hover and when active. In Clean they are grey 999px pills (0.85rem regular) with grey deep on hover. Only the active one turns crimson with white text. Tag pills can carry a muted count (tabular numerals) that inherits the active colour. Pagination pills are 2.5rem squares at 10px radius in Clean, showing up to ten pages around the current one.
- **Reader tabs** (original / translation, and translator versions when a language has several): connected strip tabs in the Gazette, separate bold grey pills in Clean. The selected tab is a pomegranate or crimson fill. Version tabs are italic in the Gazette and regular in Clean.

### Cards / Containers
- **Work card** (title, two opening lines, author and form): in the Gazette a hairline-bordered cell in a collapsed grid, where hover tints the surface and turns the title pomegranate. The incipit is italic and muted. In Clean it is a grey card with a 16px radius, `1.25rem 1.5rem`, a minimum height of 9.5rem and a grey-deep hover. The title is bold sans and the incipit is upright ink at 82% opacity. Incipit lines are truncated with an ellipsis, one line each. Persian incipits switch to Naskh, right to left.
- **Catalogue tile** (count + unit, linked to a filtered index): in the Gazette a centred cell with a tracked-caps kind label, a large pomegranate Garamond number and an italic unit. In Clean a left-aligned grey card where the 2.5rem bold number leads, the unit follows in muted text and the kind appears as a muted caption only when the unit doesn't already name it. The Works tile is filled crimson with white text: the whole collection leads.
- **Prev / next:** in the Gazette two bordered boxes that invert to ink on hover. In Clean two grey 16px cards, where hover turns the title crimson. The direction label is a muted sentence-case line in Clean. A keyboard hint (← → to move, R for a random poem) shows on pointer devices.

### Inputs / Fields
- **Gazette:** tinted surface with a 1px rule border and no radius. Focus turns the border pomegranate.
- **Clean:** grey fill with a transparent 1px border and a 10px radius, Noto Sans at 1rem. Focus turns the fill white and the border crimson. The caret is `--pomeg` in both skins.

### Navigation
- **Gazette header:** paper-coloured and sticky. The logo is pomegranate "IRS" with an ink "AZ" joined by a ◆. The nav is tracked uppercase Alegreya Sans in muted, with pomegranate for hover and the current page. A dateline strip (date · Baku · tagline) sits under a hairline and closes on a 4px pomegranate double rule.
- **Clean header:** a sticky charcoal bar with no dateline. The wordmark is white "IRS", muted ".", and header-crimson "AZ". The nav is bold uppercase in header-muted, white on hover. The current section is white with a 2px header-crimson underline. On phones the nav moves to a second row and scrolls sideways.
- **Footer (the imprint line):** one line on wide screens, stacked and centred under 900px. In the Gazette it opens on the 4px pomegranate double rule. The site's description comes first in muted italic Source Serif. The about, contribute and contact links end the line in tracked uppercase Alegreya Sans in muted, turning pomegranate on hover, with small ◆ between them. The masthead is not repeated. In Clean it is a grey-deep band with no rule. It starts with the wordmark in Noto Sans with a crimson "AZ", then the description in a muted sans, then the links in bold ink and sentence case with no separators.
- **Language switcher:** a three-segment strip (AZ / RU / EN). The active segment is a pomegranate or crimson fill. In Clean the outer ends are rounded to pills, set on a translucent white border.
- **Skin and theme toggles:** square buttons with a 4px radius in the Gazette, 2.25rem circles with 24% white borders in Clean. Each is an `aria-pressed` toggle with a "page look" or moon/sun SVG.
- **Breadcrumb:** muted interface text with › separators. The current page is pomegranate in the Gazette and bold ink in Clean. Persian crumbs switch to Naskh.

### Reading Page (signature)
The product's core surface, shared by both skins (`components/reading/ReadingView.tsx`, `app/[locale]/works/[slug]/page.tsx`, `lib/verse.ts`).
- **Header:** breadcrumb, then the centred title, the original-script title beneath it in Naskh and muted, then genre · form · year. Under that sits a "What is a ghazal?" glossary toggle: dotted-underlined accent text with a "+" in the Gazette, a drawn chevron in Clean.
- **Verse:** a **beyt** (couplet) is a block with 1.15em after it. Each **misra** (hemistich) hangs at 1.25em, and the second misra steps in to 4em, so a wrapped line never reads as a new verse. Under 480px this tightens to 0.75em and 2.25em. Non-couplet verse uses `.verse-line` with a 1.5em hang. Persian couplets go side by side at 60rem and above. The **maqta** (closing, signed couplet) is set like any other beyt; only a screen-reader label names it.
- **Parallel text:** the original and translation are lined up beyt by beyt in two columns, each headed by a language label. Inside cells every beyt stacks, whatever its script. Under 768px each row stacks with the translation beneath in muted text at 0.95em. The Gazette draws a hairline between columns and rows. Clean uses only space.
- **Folding:** texts over 40 lines open folded to their first 24 lines. A 7rem mask fades them into a centred "Read on" ("Davamını oxu") button that unfolds in place and moves focus into the text.
- **Provenance:** a centred block under every text naming the source and translator, with links in the accent colour. Missing data is shown in italics with a "suggest a translation" call to action, never hidden. The Gazette precedes it with the tailpiece. Clean gives it 2.5rem of space.
- **Tags, then share:** theme pills are centred under the text, then the share row. The share row has a muted "Share" label and round 2.5rem icon buttons (native share, Telegram, WhatsApp, Facebook, copy link, print), with a polite live status line for "Link copied".
- **Print:** both skins print the same page: black on white at 11pt, the text at 11.5pt with 1.55 leading, and 18mm × 16mm margins. The breadcrumb names the author, and folding is undone. The header, footer, controls, tabs, tags, share, navigation and "more works" are hidden. The text, provenance and a printed source URL are kept together on the last page.

### More Works and the Other Poets Band (signature)
After the text and prev/next come "More by this author" and "Other poets' poems · <theme>", each a 4-up grid of work cards. Their headings end in a drawn chevron that nudges 3px on hover. In Clean the other-poets section is a full-width grey band (`box-shadow` spread plus `clip-path`, so it bleeds to the viewport edges) holding white cards, and when it ends the page it runs straight into the footer. In the Gazette both sections open on a 4px pomegranate double rule.

### Readable Filter URLs
Filters are public paths, not query strings: `/az/works/muellif-fuzuli/forma-qezel`, `/az/authors/sairler/esr-16`. The prefixes are `muellif-` (author), `janr-` (genre), `forma-` (form) and `esr-` (century). Author types are bare words (`sairler`, `yazicilar`, `filosoflar`, `dramaturqlar`). The words are ASCII-folded Azerbaijani in every UI language (`lib/facets.ts`). Old query-string URLs 308-redirect to these paths, and a value is never renamed in place. Catalogue tiles, pills and pagination link to these paths.

### Admin
The admin (`styles/admin.css`) is a separate stylesheet in the Gazette palette and is outside the skin system. It is not restyled by Clean.

## Do's and Don'ts

### Do:
- **Do** write every new component once against the shared custom properties (`--bg`, `--ink`, `--muted`, `--surf`, `--pomeg`, `--pomeg-fill`, `--control`, `--rule`), then add its Clean override under `[data-skin='clean']` in `styles/skin-clean.css`.
- **Do** check every new surface in four states: Gazette light, Gazette dark, Clean light, Clean dark.
- **Do** keep the original and translation on the same page, lined up beyt by beyt, with provenance under the text in both skins.
- **Do** give Arabic-script text its Naskh face, 1.2× size, taller leading, and correct `lang` and `dir`, in every component that can show it.
- **Do** use inline SVG icons at 18px with 1.6–1.8 strokes and `aria-hidden`, labelling the button itself.
- **Do** in Clean, group with grey surfaces (grey, grey-deep hover), round chips to 999px and cards to 16px, and give crimson only to the single active or primary element.
- **Do** in the Gazette, head sections with pomegranate department heads, divide with 0.5px hairlines, and close major sections with the 4px pomegranate double rule.
- **Do** grow touch targets to 2.75rem on `pointer: coarse`.

### Don't:
- **Don't** carry Gazette devices into Clean: no ◆ ornaments, double rules, hairline dividers, ivory, italic incipits or tracked uppercase labels. The header nav is the only uppercase in Clean.
- **Don't** add a second accent colour to either skin.
- **Don't** add shadows to cards, tiles or buttons. Hover is a tone change.
- **Don't** use text characters (◑, ¶, +, →) as control icons. ◆ is a Gazette ornament, not an icon.
- **Don't** set display type in Georgia or another system face.
- **Don't** set new interface text below 0.75rem.
- **Don't** widen reading text past 36rem (single column), 48rem (Persian verse) or 64rem (parallel).
- **Don't** rename a filter URL word once it is public.
