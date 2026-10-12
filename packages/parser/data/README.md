# Data

Literary texts, translations and artwork metadata imported into IRS.AZ.

**The MIT license in the repository root covers the code only, not this folder.** Each file here keeps the rights of its original source. Every file records where it came from in its `sourceId` (and `sourceNote` where available).

## Sources

| Folder | Source | `sourceId` prefix | Notes |
|---|---|---|---|
| `works/` | [Ganjoor](https://ganjoor.net) | `ganjoor-` | Classical Persian-language poetry (Fuzuli, Nasimi, Khaqani, Mahsati, Nizami and others) |
| `works/` | [Azerbaijani Wikisource](https://az.wikisource.org) | `wikisource-az-` | Azerbaijani texts; `sourceNote` links the original page |
| `translations/` | C. E. Wilson (1858–1938), *The Haft Paikar (The Seven Beauties)*, 1924 | — | English translation of Nizami, OCR from a scanned copy. Public domain |
| `translations/` | H. Wilberforce Clarke, *The Sikandar Nama, e Bara*, 1881 ([Internet Archive](https://archive.org/details/sikandarnmaebara00nimg)) | — | English translation of Nizami's *Sharafnama*, OCR from a scanned copy. Public domain |
| `translations/` | E. J. W. Gibb (1857–1901), *A History of Ottoman Poetry*, 1900–1909 ([Internet Archive](https://archive.org/details/historyofottoman03gibbuoft)) | — | English translations of Fuzuli and Nasimi, OCR from a scanned copy. Public domain |
| `works/` | Məhəmməd Füzuli, *Əsərləri*, II cild, ed. Həmid Araslı, Bakı, «Şərq-Qərb», 2005 ([National Library of Azerbaijan](https://anl.az/el/f/fm_e2.pdf)) | `anl-` | *Leyli və Məcnun* in full, *Müəmmalar*, *Hədisi-ərbəin*, *Şikayətnamə* and the letters, from the PDF's text layer (`scrape-book --book fuzuli-eserleri-2`). The editor's footnotes are left out |
| `artworks/` | [The Metropolitan Museum of Art Open Access](https://www.metmuseum.org/about-the-met/policies-and-procedures/image-resources) | `met-` | Object metadata, [CC0](https://creativecommons.org/publicdomain/zero/1.0/); every object is marked public domain in the Met's API. Images are linked, not stored here |
| `artworks/` | [The Digital Walters](https://thedigitalwalters.org) | `walters-` | Manuscript miniatures, [CC BY-NC-SA 3.0](https://creativecommons.org/licenses/by-nc-sa/3.0/): credit the Walters Art Museum, non-commercial use only, share alike. Images are linked, not stored here |

## Reuse

The classical works are in the public domain. Some 20th-century authors, translations and source-site compilations may still be protected. Check the original source's terms before reusing any text.

If you hold rights to anything here and want it removed, open an issue.
