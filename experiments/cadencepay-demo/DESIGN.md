# Design: CadencePay

The familiar Patreon membership experience (cover banners, round avatars, "Become a member", locked posts, tier cards), done cleanly in CadencePay pink. The difference from Patreon is in the words, not the visuals: every screen says plainly that your money stays yours and the creator can only take the agreed amount. A passbook-themed direction was tried and rejected (2026-10-10). The landing page (`/`) and docs (`/docs`) take a bolder editorial direction (2026-10-19, inspired by neutomni.com and the climateblackbox scroll story); the demo app lives under `/app`.

## Colour (tokens in `app/globals.css` `@theme`)
| Role | Token | Value |
|---|---|---|
| Page / soft panels / lines | `page` / `soft` / `line` | `#FFFFFF` / `#F7F5F3` / `#E8E4E0` |
| Ink | `ink` / `ink-2` / `ink-3` | `#181512` / `#5C5650` / `#7C7570` |
| **Brand pink** (every primary action) | `pink` / `pink-deep` | `#C44F6B` / `#A63A56` |
| Blush (hero, empty states, chips) | `blush` / `blush-2` | `#F9ECF0` / `#F3D9E1` |
| Success | `forest` / `mint` | `#2B6C50` / `#EAF4EF` |
| Warning | `amber` / `sand` | `#8A5A00` / `#FFF4DE` |
| Creator cover colours | `hue` in `lib/creators.ts` | pink `#C44F6B`, green `#2B6C50`, blue `#3A4BC4` |

## Type
Geist, self-hosted via `next/font`.
- **Display:** `.display-thin` (weight 300, -0.04em tracking, leading .92) for big moments: the hero, the "Your money stays yours" panel, step numbers, Memberships, How it works and 404.
- **Section and UI headings:** semibold.
- **Body:** 15.5px / 1.6.
- **Geist Mono:** addresses and receipts only. `.tnum` on all amounts.

## Components
- **Pill buttons** (`.pill`, plus `.pill-lg`, `.pill-sm`, `.pill-dark`, `.pill-outline`, `.pill-white`, `.pill-danger`; use the `btn.*` helpers in `components/ui.tsx`):
  - Pink by default.
  - On hover: lift 2px, a pink-tinted glow, a soft light sweep across the face, and the arrow nudges right.
  - On press: scale .97.
  - Disabled pills go flat soft-grey.
  - `pill-dark` is for Connect; `pill-outline` is for secondary actions.
- **Cover** (`components/Creator.tsx`): a creator-colour gradient with a crisp geometric motif per creator: camera aperture (photography), dot grid with code brackets (tutorials), sound rings with a waveform (music). It's used for banners, cards, post tiles and checkout. There are no fake photos.
- **Avatar:** round, with the creator colour and initials and a white 4px ring when it overlaps a cover. It sits on its own layer (`relative z-10`).
- **Chip:** small rounded label in pink, green, amber or grey. Used for Locked, tier, status and "test network".
- **Receipt:** a mint row with a check, a plain sentence, and a mono explorer link.
- **Icons:** `components/icons.tsx`, a 24px grid at 1.75 stroke. No emoji.

## Page patterns
- **Explore:** blush hero with a giant thin headline and three tilted creator cover cards (tilt via `--r`/`--y` vars, straightening on hover); then the creator grid; then numbered steps; then the dark "Your money stays yours" panel.
- **Creator page:** full-width cover, overlapping XL avatar, name and bio, a pink "Become a member" pill (anchors to the tiers), a large latest-post card, a recent-posts grid with Locked chips, then "Choose your membership" tier cards.
- **Checkout:** a summary card on the left, and on the right exact amounts (paid today, saved, deposit, total) plus three promises and a pink pill.
- **Memberships:** one card per creator with a cover strip, avatar and status chip, three figures (balance, payments left, next payment), Top up, and a two-step Cancel.
- **For creators:** cover, avatar, creator tabs, a one-line summary (members, ready to collect, earned, coming), a Members list with Collect, and Earnings.

## Words
Plain language: "member", "membership", "join", "cancel", "collect", "payments left", "next payment", "receipt". Technical terms (cell, type script, keeper, lock, block) appear only under How it works → "For the curious".

## Motion
- Entrances (`.rise`) start **visible**.
- Hover lifts (`.lift`, `.cover-card`, `.pill`) use `cubic-bezier(.16,1,.3,1)`.
- `prefers-reduced-motion` turns it all off.

## Layout
Max width 6xl (5xl on creator pages). At 380px the nav shows Memberships plus Connect, the hero covers scroll sideways, and grids stack to one column.

## Landing page (`/`, `components/landing/`)
- **Look:** one colour (pink) on white. A giant edge-to-edge wordmark: "Cadence" in Geist semibold and "Pay" in Instrument Serif italic. Sans headlines carry a serif-italic accent phrase, with small mono uppercase labels.
- **Scroll engine:** `useScrollProgress` writes `--p` (0 → 1) on every animation frame, and CSS reads it. Pinned sections are tall `.pin-track` divs with a `position: sticky` child (the climateblackbox technique). There's no animation library.
- **Sections:**
  - wordmark + top bar
  - hero with the live testnet block number
  - a pinned showcase (neutomni's first scroll): a small frame opens to full screen, each tile is sliced off from a different side, then the frame wipes up to reveal the equation strip and the statement, which fills in word by word
  - a pinned "one membership, start to finish" story: four pink cards rise in turn while the "paid / still yours" figures update; on phones it's a deck
  - pinned 3D membership tickets whose barcodes are drawn from the CadencePay code hash
  - "can / can't" panels
  - developers with the npm install command
  - a diamond "Launch demo"
  - a pink footer with a white wordmark
- **Reduced motion:** `--p` is fixed at 1, pinning is off, and everything shows its final state.

## Docs (`/docs`)
A sticky sidebar plus a `.doc` prose column (globals.css). Code blocks have copy buttons. Pages: Introduction, Quickstart, SDK reference, On-chain rules (error codes rendered from `ERROR_CODES`), Deployments (from `TESTNET`), Security & privacy.

## Demo app motion (`/app`)
- `ScrollFx` wraps server-rendered blocks so CSS can read `--p`.
- **Explore:**
  - hero cover cards drift at different speeds
  - a serif marquee slides sideways
  - creator cards slice up into place (`.slice-in`)
  - steps rise in turn (`.step-rise`)
  - the dark promise panel opens out (`.expand-panel`)
- **Creator page:** the cover sinks slower than the page (CSS scroll timeline; static where unsupported), and tier cards slice in.
- **Headings:** page titles take a serif-italic pink accent phrase, as on the landing page.
- **Reduced motion:** all of it is off.
