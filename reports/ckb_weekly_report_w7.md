# CKB Weekly Report — Week 7
**Builder:** Linet Mugwanja  
**Period:** Sep 8 – Sep 13, 2026  
**Repo:** github.com/Linnnetteseven/ckbuilders

---

## What I Built

Two things: completed the CadencePay type script with owner/cancel
mode, and built the TypeScript SDK core with transaction building.

---

## Type Script — Owner Mode (Cancel Path)

The subscriber's lock hash is stored in the type script args at
creation. When a transaction comes in, the script checks all inputs —
if any input's lock hash matches the subscriber's, they're signing
this transaction. That means cancellation. Skip all interval
validation, exit 0.

This means the subscriber can always reclaim their cell, unconditionally,
at any time. No lock-in. The type script args are the only place this
lock hash lives — what makes owner mode trustless.

Exit codes:

| Code | Meaning |
|------|---------|
| 0 | Valid claim or owner cancellation |
| 1 | Cell data not 56 bytes |
| 2 | Interval not elapsed |
| 3 | No header_dep provided |
| 4 | Output cell missing or malformed |
| 5 | last_claimed_block not updated to current block |

---

## TypeScript SDK — @cadencepay/sdk v0.2.0

**`encodeSubscriptionData(params)`** — encodes the 56-byte cell data.
Source of truth for what goes on-chain.

**`decodeSubscriptionData(data)`** — reads raw cell bytes into readable
fields. Powers the dashboard display.

**`encodeClaimOutputData(inputData, currentBlock)`** — builds output
cell data for a claim. Identical to input except last_claimed_block
updates to currentBlock. The type script verifies this exact update.

**`canClaim(lastClaimedBlock, intervalBlocks, currentBlock)`** —
boolean check before building a claim transaction. Prevents wasted fees.

**`blocksUntilNextClaim(...)`** — countdown for the UI.

**`CadencePay.createSubscription(signer, params)`** — builds a
complete CKB transaction that creates a Subscription Cell. CCC SDK
handles coin selection. Subscriber's lock is on the output so they own
the cell and can cancel it later.

**`CadencePay.getSubscriptions(subscriberLockHash)`** — queries all
active Subscription Cells directly from the chain by type script hash.
No database. On-chain state is the source of truth.

---

## Ecosystem Research

Deep dive: FiberPass (spending permission vault, posted Sep 2),
Trickle (streaming billing), Backr (creator memberships), FiberLatch
(payment → access entitlement), Strimz (B2B subscription billing on Arc).

None of them have on-chain subscription state as a first-class CKB
cell. They all use Fiber for execution and keep authorization off-chain
or in a vault lockscript. CadencePay is the missing primitive — the
subscription agreement is a CKB cell, verifiable by anyone, subscriber
keeps custody. Not competing with FiberPass. The layer below it.

Strimz's Fanline demo shaped the architecture for the CadencePay
demo app coming in W8.

---

## Next (W8)

- CadencePay demo app — Next.js creator subscription platform
- Deploy cadencepay type script to testnet
- First real Subscription Cell on-chain
