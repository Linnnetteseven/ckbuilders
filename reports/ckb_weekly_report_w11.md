# CKBuilders Weekly Report — Week 11

**Builder:** Linnette Mugwanja (@Linnette77)
**Period:** Oct 5 – Oct 11, 2026

---

## Summary

I reviewed my CadencePay type script, found real bugs, and rewrote it as v3 with 46 attack tests. Members now sign with their own wallet (JoyID), and the full flow is verified on testnet. The demo is now a Patreon-style membership app: https://cadencepay-demo.vercel.app

## What I built

**Security review:** v2 claims never paid the creator, cells could be drained or merged, "owner mode" skipped every check, and the server key controlled every subscription. Details are in `notes/w10-w11-audit.md` and `notes/cadencepay-threat-model.md`.

**Type script v3:**
- Input Type Proxy Lock plus Type ID, so the type script alone enforces the rules and collecting needs no private key.
- Modes: join, collect, top-up, cancel, close.
- **49/49 tests passing**, including 46 attack tests written before the fix.
- Code hash `0x7c271b62bc4b726f5997f3dbd221cfdbf31c944da19871dc1d8fc3bb75910419`, deploy tx `0x8acdf7ed16e21ed29c3fc0c9f2067e8901e7ee8dce5a1b4c686e5c24c9eada8b`.

**SDK v0.3.0:** unsigned builders for every mode. Join pays the first period upfront. 19/19 tests.

**Custody:** the server key is gone from every signing path. Members sign with JoyID, and a fee-only keeper collects due payments. KeyWay is paused while its builder rewrites it.

**Testnet run (real wallet):**

| Step | Tx | Result |
|---|---|---|
| Join | `0x7b639369…dd12` | 100 CKB to the creator, 526 CKB membership balance |
| Collect ×2 | `0x4b0dac73…db02`, `0x15297227…3ce0` | +100 CKB to the creator each time |
| Top-up | `0x679ca6b8…9027` | Balance back to 526 CKB |
| Cancel | `0x96925887…f234` | Full refund to my wallet |

**App:** explore creators, creator pages with gated member posts (checked by wallet signature plus an on-chain membership check), checkout, member dashboard, and creator dashboard. It's in plain language and works on mobile.

## Research

- **Obscell:** stealth addresses work on testnet but are unaudited, so stealth payouts are a stretch goal.
- **SP1 verifier:** about 63M cycles, so private membership proofs are realistic as future work.
- **Strimz:** billing pulls from an allowance on the whole wallet; with CadencePay only the membership balance is ever reachable.

Notes: `notes/research-security-privacy.md`

## What I learned

- Passing tests doesn't mean a script is correct. Attack tests found what happy-path tests missed.
- With a proxy lock, the type script is the only guard, so every mode must check amounts, counts and signers.
- Login and signing are separate: the member's own wallet must sign anything that moves their money.

## Challenges

- My W9 demo looked like it worked but didn't pay creators or give subscribers custody.
- Key hygiene: deploy keys were in my shell history.
- A wallet connector crash, and a Vercel deploy that had silently failed since Sep 28.

## Plan for Week 12

- README with an architecture diagram
- Publish the SDK to npm

## Links

- Repo: https://github.com/Linnnetteseven/ckbuilders
- App: https://cadencepay-demo.vercel.app
- Testnet records: `notes/deployments.md`
