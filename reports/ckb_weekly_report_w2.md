# CKBuilders Weekly Report — Week 2

**Builder:** Linet Mugwanja ([@Linnnetteseven](https://github.com/Linnnetteseven))
**Week Ending:** August 9, 2026
**Program Month:** 1 of 3

---

## Courses / Reading Completed

- CKB Docs — [Store Data on Cell](https://docs.nervos.org/docs/dapp/store-data-on-cell)
- CKB Docs — [RFC 0022 — Transaction Structure](https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0022-transaction-structure/0022-transaction-structure.md) — initial read, notes filed
- Rust Book — Chapters 1–3: setup, Cargo, variables, functions, control flow
- Rust: ownership, borrowing, enums, and Result error handling (hands-on)

---

## Key Learnings

**Store Data on Cell.** A cell's data field accepts arbitrary bytes.
The encoding strategy is up to the developer — we used JSON → UTF-8 → hex
for human-readable on-chain data. Retrieval uses `getLiveCell` via RPC
with the OutPoint (txHash + output index) as the identifier.

**RFC 0022 — Transaction Structure.** Worked through the core fields:
inputs (cells consumed), outputs (cells created), `cell_deps`
(script code referenced but not consumed), `witnesses` (signatures kept
outside the tx hash to avoid circular dependency), and `header_deps`
(block header references for time-based script logic — relevant for v2).

**Rust — Ownership.** One owner per value at a time. Passing a value
to a function moves ownership — the original binding is gone. Borrowing
(`&T`) lets a function read a value without taking ownership. The
compiler enforces this at build time, making use-after-free bugs
impossible. Direct relevance to CKB: a lock script that mishandles
witness data is caught by the compiler before it touches the network.

**Rust — Result and Enums.** `Result<T, E>` forces explicit handling
of both success and failure. Combined with named error enums, every
failure path is typed and exhaustively matched. In CKB lock scripts,
non-zero exit codes signal rejection — our `CapsuleError` enum models
this pattern: each variant maps to a specific exit code.

---

## Practical Progress

**Store Data on Cell tutorial — complete**
Ran on devnet, stored "Linnette was here" in a cell data field.
Code: [`experiments/store-data-on-cell/`](../experiments/store-data-on-cell/)

**CKB Time Capsule — built and deployed**
A FutureMe-style dApp that seals messages to your future self
permanently on-chain using the CKB cell data field.

- Seal: JSON-encodes message + metadata → UTF-8 hex → cell data field
- Read: retrieves live cell by OutPoint (txHash + index 0)
- Lock: hides message until open date (client-side, v1)
- Planned v2: cryptographic time-lock via `header_deps` + custom lock script

Live: [ckb-time-capsule.vercel.app](https://ckb-time-capsule.vercel.app)
Code: [`experiments/ckb-time-capsule/`](../experiments/ckb-time-capsule/)

Testnet tx (first capsule sealed on live deployment):
[`0xceada44320cdcbeed...`](https://testnet.explorer.nervos.org/transaction/0xceada44320cdcbeed79e3f00bb717958d89da)

**Rust fundamentals — two exercises**
- Ownership and borrowing: [`experiments/rust-fundamentals/ownership-basics/`](../experiments/rust-fundamentals/ownership-basics/)
- Error handling with Result and enums: [`experiments/error-handling/`](../experiments/error-handling/)

---

## Challenges

**`@ckb-ccc/ccc` vs `@ckb-ccc/core`.**
The CCC meta-package pulls in browser wallet connectors including
`@ckb-ccc/shell` which Parcel cannot resolve in a non-browser-wallet
setup. Fix: use `@ckb-ccc/core` — the lean package with transaction
building, signing, and RPC only. No unnecessary dependencies.

**Rust PATH not set in shell.**
`cargo` not found after install — resolved by running
`source ~/.cargo/env`. Added to notes for future sessions.

---

## Plan for Week 3 (Aug 11 – Aug 17)

- [ ] RFC 0022 deep read — complete notes, understand Molecule serialization
- [ ] Read [`intro-to-script`](https://docs.nervos.org/docs/script/intro-to-script) — Lock vs Type Script execution model in depth
- [ ] Rust Book Chapters 4–8 — structs, enums, collections, error handling
- [ ] CKB Time Capsule v2 — wallet connection via CCC, remove private key input
- [ ] Begin reading `ckb-std` crate documentation

---

*Resources: [CKB Docs](https://docs.nervos.org) · [RFC 0022](https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0022-transaction-structure/0022-transaction-structure.md) · [CCC SDK](https://docs.nervos.org/docs/sdk-and-devtool/ccc) · [Rust Book](https://doc.rust-lang.org/book/) · [Vercel](https://vercel.com)*
