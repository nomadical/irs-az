# TODO

## Authors to add
Public domain (died 1955 or earlier, life + 70), except that Soviet-era authors and translators, Baba Pünhan and Iranian Azerbaijani authors are treated as public. Sources are unverified until the box is ticked.

- [x] Qətran Təbrizi — XI, FA — Ganjoor
- [x] Mücirəddin Beyləqani — XII, FA — Ganjoor
- [x] Fələki Şirvani — XII, FA — Ganjoor
- [x] Əvhədi Marağalı — XIV, FA — Ganjoor
- [x] Qazi Bürhanəddin — XIV, AZ — wikisource has 39 poems of a ~1,500-poem divan; the rest needs OCR
- [x] Həbibi — XVI, AZ — wikisource
- [x] Saib Təbrizi — XVII, FA + AZ — Ganjoor: ghazals, Turkic ghazals (7 with az.wikisource transliterations), qasidas, miscellany (7,743); single couplets, opening lines and attributed poems skipped
- [x] Molla Vəli Vidadi — XVIII, AZ — wikisource
- [x] Qasım bəy Zakir — XIX, AZ — wikisource
- [x] Seyid Əzim Şirvani — XIX, AZ + FA — wikisource
- [x] Xurşidbanu Natəvan — XIX, AZ + FA — wikisource
- [x] Mirzə Şəfi Vazeh — XIX, AZ + FA — wikisource; only his 7 original works. The "Mirzə Şəfi nəğmələri" cycles are Bodenstedt's, could go in as Bodenstedt's German originals (PD)
- [x] Abbasqulu ağa Bakıxanov — XIX, AZ + FA — wikisource
- [x] Aşıq Ələsgər — XIX–XX, AZ — wikisource
- [ ] Nəcəf bəy Vəzirov — XIX–XX, AZ plays — not on wikisource: every link on his author page is a missing page; needs OCR of a printed edition; the Presidential Library has the 2005 Şərq-Qərb *Əsərləri* as an e-book (preslib.az/az/elibrary/ebook/8f6IWYG1, download behind email + captcha): plays only, not the editor's notes
- [x] Cəlil Məmmədquluzadə — XX, AZ prose — wikisource
- [x] Əbdürrəhim bəy Haqverdiyev — XX, AZ prose + plays — wikisource has 2 stories; 8 works and acts 3–5 of "Ağa Məhəmməd şah Qacar" are missing pages, the rest needs OCR
- [x] Məhəmməd Hadi — XX, AZ — wikisource
- [x] Abbas Səhhət — XX, AZ — wikisource
- [x] Mikayıl Müşfiq — XX, AZ — wikisource

Next batch (az.wikisource author pages; counts are linked pages that exist, unchecked):
- [x] Əhməd Cavad — XX, AZ — wikisource (191: rübais and qitʿas split; the ghazal page is single couplets, kept whole)
- [x] Aşıq Qurbani — XVI, AZ — wikisource, 143 works (with "Dirili Qurbani" pages)
- [x] Əliqulu Qəmküsar — XX, AZ — wikisource, 75 poems and 33 feuilletons
- [x] Almas İldırım — XX, AZ — wikisource ("Almas Yıldırım"), 88 poems
- [x] Aşıq Abbas Tufarqanlı — XVII, AZ — wikisource, 82 poems and the dastan "Abbas və Gülgəz" (2 links are red)
- [x] Xəstə Qasım — XVIII, AZ — wikisource, 81 poems (one page is Molla Qasım's, the dastan page is red)
- [x] Firidun bəy Köçərli — XX, AZ criticism — wikisource, 35 articles and 61 chapters of Azərbaycan ədəbiyyatı (vol. II is only partly on wikisource)
- [x] Fatma xanım Kəminə — XIX, AZ — wikisource, 18 ghazals and a qoşma
- [x] Üzeyir Hacıbəyov — XX, AZ librettos + satire — wikisource, 2 comedies, 5 libretti (Rüstəm və Söhrab: act I only), 10 articles and sketches, Milli marş
- [x] Mir Möhsün Nəvvab — XIX, AZ + FA — wikisource, 15 poems; Təzkireyi-Nəvvab skipped (2018 translation by living translators)
- [x] Qövsi Təbrizi — XVII, AZ — wikisource, 13 ghazals and 2 other poems
- [x] Nəriman Nərimanov (29: 4 plays, stories, feuilletons, letters), Əli bəy Hüseynzadə (10 poems), Heyran xanım (9), Mirzə Ələsgər Növrəs (6), Kişvəri (8) — wikisource
- Too little on wikisource: Çəmənzəminli (2), Süleyman Sani Axundov (1), Nişat Şirvani (2), Məsihi (1), Qənizadə (1); no author page: Seyid Nigari, Möcüz, Abdulla Tofiq Sur, Ömər Faiq Nemanzadə, Nəbati

Housekeeping:
- [x] Delete the empty duplicate authors `nizami-gencevi` and `nesimi` from the DB
- [x] Publish Səməd Vurğun's *Leyli və Məcnun* and Lipskerov's Russian Nizami (Soviet-era translations count as public)

Now eligible under the Soviet-era and Iranian Azerbaijani exceptions:
- [x] Şəhriyar — ganjoor: Heydərbabaya salam (both parts; Sarvatian's interleaved Persian translation dropped), 30 Azerbaijani poems, 162 Persian ghazals
- [x] Əliağa Vahid — his 13 Xaqani translations on wikisource are AZ translations of Xaqani's ghazals (13, 31, 47, 70, 107, 121, 195, 204, 238, 239, 241, 332, 341), matched by hand; he has only one poem of his own there
- [x] Abdulla Şaiq — 357 works from the National Library's PDFs of the 2005 Avrasiya Press reprint (3 vols): stories, Xasay, the novels, poems, ghazals, poemas, plays in acts, children's verse, tales and fables (`scrape-reprint`)
- [ ] Other authors in the 2004–2005 Latin-script state reprints on web2.anl.az: `scrape-reprint` reads their font and layout
- And later Soviet-era authors

## Later
- [ ] Browser extension — poem of the day on the new-tab page, plus a "random poem" button
- [ ] Mobile app (React Native / Expo) — reading, offline favourites, daily poem notification
- [ ] Home-screen widget (iOS / Android) showing the poem of the day

All three can build on `GET /api/works/daily` and `GET /api/works/random`.
