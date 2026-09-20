# CKB Weekly Report — Week 8
**Builder:** Linet Mugwanja  
**Period:** Sep 14 – Sep 20, 2026  
**Repo:** github.com/Linnnetteseven/ckbuilders

---

## What I Built

CadencePay demo app — a Next.js creator subscription platform.
Four pages, full flow, deployable.

---

## Pages

**Home** (`/`) — landing page, protocol explanation, three entry points.

**Creator** (`/creator`) — set subscription amount and interval.
Preset daily/weekly/monthly buttons. Live preview of terms.
Generates a shareable subscribe link. One click to deploy
the Subscription Cell when wallet is connected.

**Subscribe** (`/subscribe`) — shows creator's subscription terms.
Connect wallet, one transaction, done. The output is a Subscription
Cell on CKB — owned by the subscriber, cancellable at any time, no
funds locked in a vault.

**Dashboard** (`/dashboard`) — all active Subscription Cells for the
connected wallet. Shows last claimed block, current block, blocks until
next claim. Claim button enables when interval elapsed. Cancel button
triggers owner mode in the type script.

---

## Architecture note

The dashboard queries CKB cells directly by type script hash via
`CadencePay.getSubscriptions()`. No database, no backend, no trusted
service. The chain is the source of truth. This is what CadencePay's
cell-first design makes possible — something that's not practical with
authorization-only approaches like FiberPass.

---

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · @cadencepay/sdk
· @ckb-ccc/core (wallet connection, W9)

---

## What's mock vs real

UI runs on mock data so the full flow is explorable now. W9 wires
real chain interactions:
- Deploy cadencepay binary to testnet → get code hash
- Connect CCC wallet via JoyID / CKB Keyway
- `createSubscription()` submits a real transaction
- `getSubscriptions()` queries real testnet cells
- Deploy to Vercel → public link for TG review

---

## Next (W9)

- Testnet deploy + wallet integration
- Live Vercel deployment
- Share in builders TG for review
- Neon update
