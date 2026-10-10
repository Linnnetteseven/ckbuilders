# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
- **Fans / supporters**, many new to crypto, paying a creator they like. Job: join a tier, read member posts, see what they've paid and what's left, top up or leave without anxiety.
- **Creators** (photographers, teachers, DJs; the demo creators are Kenyan). Job: get paid on schedule, see who supports them and what's ready to collect, collect it.
Both audiences are primary: Explore and checkout speak to fans; the creator dashboard speaks to creators.

## Product Purpose
CadencePay is a creator membership app (Patreon-style: tiers, member-only posts, member and creator dashboards) built on CadencePay, a recurring-payment primitive on CKB. Success: a newcomer joins, reads member posts, and cancels in under three minutes without ever seeing a key or seed phrase; a creator sees supporters and collects payments.

## Positioning
Fans keep their own money. Each membership is a balance the fan funds and controls; the creator can collect only the agreed amount, once per period, enforced on-chain. Fans can top up or cancel any time and get the rest back. Payments due can be collected by anyone (or automatically) and always land with the creator. Unlike card subscriptions or token allowances, there is no open-ended permission to pull from the fan's wallet.

## Operating Context
- CKB testnet only (free test CKB from faucet.nervos.org). Unaudited demo; never real money.
- Wallet: JoyID via CCC (passkey, no seed phrase). Other CKB wallets may appear in the picker.
- Payment periods in the demo are ~1 hour (450 blocks) so collections are visible quickly.
- Part of the CKBuilders program capstone; reviewers and other builders also read it.

## Capabilities and Constraints
- Live: explore creators, creator pages with tiers and public/member posts, member posts unlocked by a signed wallet check plus an on-chain membership check, checkout per tier (first period paid immediately), memberships (balance, payments left, next payment, low-balance warning, top up, cancel with refund), creator dashboard (members, ready to collect, collect all, payments received with explorer receipts).
- Creators and posts are fixed demo data (three fictional creators); no creator sign-up yet.
- Minimum tier price ~61 CKB; demo tiers 80–250 CKB.
- **Terminology (main UI):** keep "CKB" as the currency and "wallet". Avoid jargon: say "membership balance" (not cell), "collect" (not claim), "payment period" (not interval/blocks), "receipt" (not tx hash). Technical terms (cell, type script, keeper, lock, block numbers) live only on How it works and in small receipt links.
- Every page needs loading, empty and error states; must work at 380px wide.

## Brand Commitments
- Name: **CadencePay** for both the app and the protocol.
- Voice: plain, warm, confident, specific; no hype words, no exclamation marks.
- **Visual reference (Linnette, 2026-10-10):** familiar Patreon-style membership UI played straight (patreon.com and its creator pages): cover banner + overlapping round avatar, "Become a member" pill, post cards with Locked chips, tier cards. Keep the **pink #C44F6B** from the earlier UI as the brand colour. Creative in details, not metaphor (the passbook direction was tried and rejected).
- Light Kenyan touch: English UI with occasional Swahili words and Nairobi references, as in the demo creators (Wanjiru Frames, Otieno Builds, Matatu Sound).

## Evidence on Hand
- Real testnet transactions (subscribe, two collections, top-up, cancel) recorded in `../../notes/deployments.md`.
- No real users, testimonials, metrics or press. Do not invent any.

## Product Principles
1. Your money stays yours: every screen makes the limit (amount, period, cancel any time) obvious.
2. Plain words first, technical proof one tap away (receipts, How it works).
3. Never surprise: show exactly what leaves the wallet before signing.
4. Creators get paid without chasing anyone.
