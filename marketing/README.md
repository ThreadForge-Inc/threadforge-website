# ThreadForge v10.17.2 branding & marketing kit — index

One entry point into everything already approved for release v10.17.2 (31 October 2026). Nothing
below is new copy: it is a map of what exists, checked against the live code and the website on
2026-10-31, so a press contact, reseller or teammate can be handed this folder and find everything
without asking.

## 1. Start here

- **`00-core-message.md`** — the one page to read first: product line, pricing, three facts to lead
  with, short variants (40/90/160 characters), approved films, and what to say plainly (unsigned
  Windows installer, no Google Play yet, calculations are estimates).

## 2. Visual identity

- **Brand kit page:** https://threadforgeofficial.com/brand/ — logos (primary, reversed, mark-only)
  as downloadable SVGs at `/assets/brand/threadforge-logo.svg`, `-logo-reversed.svg`,
  `-mark.svg`; clear-space and minimum-size rules; voice rules (no ® or ™, nothing claimed the site
  doesn't say).
- **Colours:** forge green `#173F30` · signal lime `#D6EE8E` · sage paper `#EEF1E8` · ink `#12241C`.
- **Fonts:** Gloock (headlines) · Public Sans (body/labels) · JetBrains Mono (versions, prices,
  commands).
- **`image-spec.md`** — the same palette/fonts, written for anyone cutting a new social image or
  slide; prefer a still from an approved film over a new graphic.

## 3. Films (already produced, link don't re-cut)

- 10.17 milestones, 56 s — `/assets/film/threadforge-1017-1080p.mp4` (9:16 variant included)
- The pioneer journey, 54 s — `/assets/film/threadforge-journey-1080p.mp4` (9:16 variant included)
- ThreadForge in 85 seconds — `/assets/film/threadforge-film-1080p.mp4`

## 4. Per-platform copy, ready to post

| File | Platform | Status |
| --- | --- | --- |
| `x-thread.md` | X | Launch wave, live |
| `linkedin.md` | LinkedIn | Launch wave, live |
| `reddit.md` | Reddit | Launch wave, live |
| `whatsapp.md` | WhatsApp/SMS broadcast | Launch wave, live |
| `institutional-outreach.md` | Email, institutions | Live, last checked 2026-10-31 against 10.17.2 |
| `handouts-launch.md` | X, LinkedIn, WhatsApp | **New** — free Academy lecture handouts (10.17.1) |
| `store-courtesy-window.md` | X, WhatsApp, LinkedIn | **New** — Store Professional courtesy, time-boxed |
| `90-day-calendar.md` | All | The posting schedule tying the above together |

The four "launch wave" files already cite 10.17.2's own numbers (543 backend tests, 52 native Windows
checks) under the "ThreadForge 10.17" product-line name used throughout the docs (CAPABILITIES-10.17.0
through -10.17.2 are one line); they did not need changes. The two new files cover angles that opened
only in 10.17.1 and 10.17.2 and that the launch wave predates.

## 5. Customer-facing guide PDFs (owner and student)

- **Owner/teacher version** (13 pages, with the answer key): `/api/suite/handouts/ThreadForge-Lecture-Handout-10.17.pdf`
- **Student version** (12 pages, no answer key): `/api/suite/handouts/ThreadForge-Lecture-Handout-10.17-Student.pdf`
- Both ship inside the app (Guides desk, any signed-in role) and on the website's Academy page, and
  were checked line-by-line against the current `tenancy.py`, `server.py`, `business_connectors.py`
  and `licence.py` on 2026-10-31: **every fact in them still holds for 10.17.2.** `tenancy.py` and
  `business_connectors.py` have not changed since 10.17.0; the `licence.py`/`server.py` changes since
  then only added the Microsoft Store Professional courtesy and Google Play handling, which the
  handouts' four lecture parts (connectors, tokens, request flow, repository access) don't depend on.
  No content edit was needed — see `store-courtesy-window.md` for how that one new fact is covered
  instead, in the handouts' companion social post.

## 6. Social channels (audited 2026-10-31, all 13 public pages identical)

Every public page except `/demo/` and `/moonwalk/` (standalone app views with no marketing chrome)
carries the same five footer buttons, byte-for-byte:

| Channel | Destination |
| --- | --- |
| YouTube | youtube.com/@ThreadForgeOfficial |
| Instagram | instagram.com/mistar_n0buddy |
| WhatsApp | wa.me/923352328151 |
| X | x.com/i/user/2116563049096376320 |
| Reddit | reddit.com/user/threadforge00 |
| LinkedIn | linkedin.com/in/thread-forge-731074445/recent-activity/all/ |

Two things worth your own call, not fixed here because they're brand decisions, not bugs:
- The Instagram handle (`mistar_n0buddy`) doesn't carry the ThreadForge name the way the other four
  channels do — worth a rename or a redirect if that account is meant to represent the product.
- The X link is a numeric user-ID URL rather than an `@handle` — it works, but a reader can't see or
  verify the handle at a glance the way they can on the other four buttons. Worth switching to the
  `@handle` form once you're sure it's final, since every published post should use the same link.

## 7. Languages

The site is now in 16 languages: English, English (UK), Urdu, Arabic, Persian, Simplified Chinese,
Japanese, Hindi, Russian, German, French and Italian — `website/i18n/strings.json` and `subtitles.json`,
built by `website/i18n/build_i18n.py`. Every translated page states plainly that it is translated from
English and that the English text is authoritative where they differ (`website/i18n/README.md`). As with
the existing Urdu/Arabic/Chinese pages, these were drafted from the English source and should be read by
a native speaker of each language before being promoted widely — that review has not happened yet.

## 8. What is not in this kit

Store listings (Microsoft Store, Google Play draft) live in `store-listing/`; Android-specific
packaging in `clients/android/`. The brand kit page is the only place approved logo files are served
from — don't attach a locally-exported copy to outbound email, link the page instead, so any future
logo update reaches everyone who was sent it.
