# CKBuilders Weekly Report — Week 1

**Builder:** Linet Mugwanja ([@Linnnetteseven](https://github.com/Linnnetteseven))
**Week Ending:** August 2, 2026
**Program Month:** 1 of 3

---

## Environment Setup

Local CKB development environment established and verified:

- **offCKB** installed — local devnet running via `offckb node`
- **Simple Lock** TypeScript contract compiled and deployed to local devnet
- Public `ckbuilders` GitHub repo initialised with directory structure and `.gitignore`
- Setup verified by coordinator (Neon) via screenshot

---

## Courses / Reading Completed

- CKB Docs — [How CKB Works](https://docs.nervos.org/docs/getting-started/how-ckb-works)
- CKB Docs — [Quick Start](https://docs.nervos.org/docs/getting-started/quick-start)
- CKB Academy — Module 1: Cell and Transaction structure

---

## Key Learnings

**Cell Model.** CKB's fundamental unit is a Cell, not an account. Every cell carries capacity, data, a lock script, and an optional type script. Capacity must be >= the cell's byte size — on-chain storage is an explicit economic cost. State change is modelled as cell consumption and creation, not mutation.

**Transactions.** Inputs are cells being permanently consumed. `cell_deps` are cells referenced but not consumed — script binaries live here. `witnesses` are kept outside the transaction hash so signatures can commit to the body without a circular dependency.

**Lock vs Type Scripts.** A Lock Script executes when a cell is spent — it enforces ownership. A Type Script executes on both inputs and outputs — it enforces state transition rules. Both are RISC-V binaries stored as cell data, identified by `code_hash`, `hash_type`, and `args`.

**CCC SDK.** The TypeScript SDK handles input cell selection, fee calculation, transaction signing, and broadcast. Amounts are expressed in Shannons as `BigInt` — 1 CKB = 10^8 Shannons, which exceeds JavaScript's safe integer range.

---

## Practical Progress

- Deployed **Simple Lock** contract to local devnet — confirmed via offCKB explorer
- Executed first **CKB testnet transfer** using the CCC SDK:
  - 100 CKB from account #0 → account #1
  - Tx hash: [`0xd7df29aee82bfe1616b7a17267f87bcf30f98ce3bf8bb950c7735f1092dba25b`](https://testnet.explorer.nervos.org/transaction/0xd7df29aee82bfe1616b7a17267f87bcf30f98ce3bf8bb950c7735f1092dba25b)
  - Explorer shows input cells consumed, recipient output created, change output returned to sender
- Resolved `ts-node` / TypeScript 7 incompatibility — replaced with `tsx`

Experiment code: [`experiments/testnet-transfer/`](../experiments/testnet-transfer/)

---

## Plan for Week 2 (Aug 4 – Aug 7)

- [ ] RFC 0022 — Transaction Structure (full read)
- [ ] CKB Academy — complete Module 1 interactive exercises
- [ ] Read [`intro-to-script`](https://docs.nervos.org/docs/script/intro-to-script) — Lock vs Type Script execution model in depth
- [ ] Rust Book Chapters 1–5 — ownership and structs (prerequisite for script development)
- [ ] Store Data on Cell tutorial via CCC SDK

---

*Resources: [offCKB](https://docs.nervos.org/docs/sdk-and-devtool/offckb) · [CKB Docs](https://docs.nervos.org) · [CKB Academy](https://academy.ckb.dev) · [CCC SDK](https://docs.nervos.org/docs/sdk-and-devtool/ccc)*
