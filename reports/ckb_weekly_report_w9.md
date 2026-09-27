# CKB Weekly Report — Week 9
**Builder:** Linet Mugwanja  
**Period:** Sep 22 – Sep 27, 2026  
**Repo:** github.com/Linnnetteseven/ckbuilders

---

## What I Built

CadencePay MVP — a cell-native recurring payment protocol on CKB.
This week: type script deployed to testnet, real Subscription Cells
created on-chain, claim transactions verified, keeper cron added for
automatic payment collection.

---

## Type Script — Live on Testnet

Deployed the CadencePay type script (Rust/RISC-V) to CKB testnet.
The script handles three modes:

**Creation mode** — no GroupInput exists yet. Validates the output
cell is well-formed and last_claimed_block = 0.

**Claim mode** — interval elapsed check via header_deps (RFC 0022).
Validates output cell updates last_claimed_block to current block.
Enforces recipient, amount, and interval are unchanged.

**Owner/cancel mode** — subscriber lock hash found in inputs.
Exits 0 unconditionally — subscriber can cancel any time.

Code hash: 0x05d60806d86b478715633f846d2e4d31e60b95b4ea0af4f5ce6c72e19d4b6fb4
TX:        0x5ee7b1eacd6065bf2f040d678ae2e21987390317dfaadeec1b69be3e8574a3d9
Hash type: data1

The first deployment failed at creation — type scripts run on both
inputs and outputs. Creating a cell for the first time has no
GroupInput. The script tried to load it, returned InvalidDataSize
(exit code 1), chain rejected. Fixed by adding a creation mode branch.

---

## Subscription Cells on Testnet

Three real Subscription Cells created and claimed:

0x9d8e58e4...  lastClaimedBlock: 22,494,262
0x3cab461c...  lastClaimedBlock: 22,494,615
0xd9b32a4a...  lastClaimedBlock: 22,494,678

Each claim: type script loaded via cellDep, header_dep provided for
current block number, output cell recreated with updated
last_claimed_block. All three verified on the Pudge explorer.

---

## Demo App

Four-page Next.js app deployed at cadencepay-demo.vercel.app

- Home: protocol explanation, two entry points
- Creator: set payment amount and interval, share link
- Subscribe: connect via CKB KeyWay, create Subscription Cell
- Dashboard: live cell data from testnet indexer, collect payments

Three API routes handle all chain interaction server-side:
/api/subscribe, /api/subscriptions, /api/claim

The dashboard reads directly from the CKB testnet indexer — no
database, no cached state. What you see is live chain data.

---

## Keeper — Automatic Payment Collection

Added a Vercel Cron job at /api/cron/claim that runs every 2 hours.
Scans all active Subscription Cells and triggers claims for any where
canClaimNow is true.

CKB has no on-chain scheduler — transactions must be submitted by
someone. The keeper handles this off-chain while the type script
handles enforcement on-chain.

---

## CKB KeyWay Integration

Email login via CKB KeyWay working. Subscriber lock hash used in type
script args for cancel mode — ownership semantics correct even though
the demo uses server-side signing for transaction submission.

The 401 errors during testing were Stytch OTP rate limiting from
repeated failed attempts. Not a CORS or CSP issue. Resolved by
waiting for cooldown.

---

## Subscription Cell Data Layout

[0..32]  recipient_lock_hash   blake2b(creator lock script)
[32..40] amount_per_interval   shannons (u64 LE)
[40..48] interval_blocks       blocks between claims (u64 LE)
[48..56] last_claimed_block    block number of last claim (u64 LE)

Type script args: subscriber_lock_hash (enables owner/cancel mode)

56 bytes is the data field only. Total cell size including script
overhead is ~200 bytes, requiring 200 CKB minimum capacity.

---

## Protocol Positioning

CadencePay is an on-chain subscription primitive, not just a creator
app. The type script is the infrastructure — any developer can
reference the deployed code hash and build subscription billing
without rebuilding the enforcement logic. Use cases: SaaS billing,
DAO memberships, open source funding, payroll, API access gating.

The demo is a creator subscription app to prove the protocol works.
The submission is the protocol, the demo is the proof.

---

## Next (W10)

- Cancel flow — wire cancel button to a real transaction
- Creator deploy through UI
- Molecule serialization for structured cell data
- Verify keeper cron runs and claims correctly
- Nervos Talk writeup draft
