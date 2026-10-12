# TODO

## Authors to add
Public domain only (died 1955 or earlier, life + 70). Sources are unverified until the box is ticked.

- [x] Qətran Təbrizi — XI, FA — Ganjoor
- [x] Mücirəddin Beyləqani — XII, FA — Ganjoor
- [x] Fələki Şirvani — XII, FA — Ganjoor
- [x] Əvhədi Marağalı — XIV, FA — Ganjoor
- [x] Qazi Bürhanəddin — XIV, AZ — wikisource has 39 poems of a ~1,500-poem divan; the rest needs OCR
- [x] Həbibi — XVI, AZ — wikisource
- [ ] Saib Təbrizi — XVII, FA + AZ — Ganjoor has 9,877 poems (more than the whole site today); deferred
- [x] Molla Vəli Vidadi — XVIII, AZ — wikisource
- [x] Qasım bəy Zakir — XIX, AZ — wikisource
- [x] Seyid Əzim Şirvani — XIX, AZ + FA — wikisource
- [x] Xurşidbanu Natəvan — XIX, AZ + FA — wikisource
- [x] Mirzə Şəfi Vazeh — XIX, AZ + FA — wikisource; only his 7 original works. The "Mirzə Şəfi nəğmələri" cycles are Bodenstedt's, could go in as Bodenstedt's German originals (PD)
- [x] Abbasqulu ağa Bakıxanov — XIX, AZ + FA — wikisource
- [x] Aşıq Ələsgər — XIX–XX, AZ — wikisource
- [ ] Nəcəf bəy Vəzirov — XIX–XX, AZ plays — not on wikisource: every link on his author page is a missing page; needs OCR of a printed edition
- [x] Cəlil Məmmədquluzadə — XX, AZ prose — wikisource
- [x] Əbdürrəhim bəy Haqverdiyev — XX, AZ prose + plays — wikisource has 2 stories; 8 works and acts 3–5 of "Ağa Məhəmməd şah Qacar" are missing pages, the rest needs OCR
- [x] Məhəmməd Hadi — XX, AZ — wikisource
- [x] Abbas Səhhət — XX, AZ — wikisource
- [x] Mikayıl Müşfiq — XX, AZ — wikisource

Housekeeping:
- [x] Delete the empty duplicate authors `nizami-gencevi` and `nesimi` from the DB
- [ ] Confirm Azerbaijan's copyright term; Vurğun (d. 1956) is only PD from 2027 under life + 70
- [ ] 1 January 2027: publish Səməd Vurğun's translation of Nizami's *Leyli və Məcnun* (46 drafts): drop `hold` from `data/config/translations/vurgun-leyli-ve-mecnun.json`, re-run `scrape-translations --book vurgun-leyli-ve-mecnun`, import with `--translator "Səməd Vurğun" --publish`

Not yet (in copyright): Abdulla Şaiq (free 2030), Əliağa Vahid (free 2036), Şəhriyar and later.

## Later
- [ ] Browser extension — poem of the day on the new-tab page, plus a "random poem" button
- [ ] Mobile app (React Native / Expo) — reading, offline favourites, daily poem notification
- [ ] Home-screen widget (iOS / Android) showing the poem of the day

All three can build on `GET /api/works/daily` and `GET /api/works/random`.
