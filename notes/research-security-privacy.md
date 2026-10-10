# Research: CKB script security, privacy, and product (Phase 2)

**Date:** 2026-10-07 · All in my own words. On-chain facts were checked against CKB testnet RPC (`testnet.ckb.dev`) on this date. Sources are listed at the end, and each section references them as [S#].

---

## A. CKB script security

### A1. How scripts run: groups (and why counting matters) [S1][S2]
- CKB **groups** scripts before running them. A lock script runs **once per unique lock script** across the inputs. A type script runs **once per unique type script across inputs AND outputs combined**.
- So the CadencePay type script runs **one time** for a transaction that consumes 2 subscription cells and creates 1. It sees all of them through `GroupInput` / `GroupOutput`, and it is responsible for checking all of them. If it only looks at index 0, as ours does today, every extra cell in the group goes unchecked.
- "Same script" means identical `code_hash` + `hash_type` + `args`. Ours puts the subscriber lock hash in `args`, so **two subscriptions from the same subscriber share one group**. That's exactly the merge (2→1) and split (1→2) case. Two subscriptions from different subscribers are separate groups.
- **Rule for us:** every mode must assert exact counts (`GroupInput` len, `GroupOutput` len) before reading index 0.

### A2. ckb-js-vm "exit(0)" lesson [S3]
- The ckb-js-vm security page warns that a dynamically loaded module containing a plain `exit(0)` ends the whole script with **success** and skips validation. It also warns that a top-level `return` in a QuickJS module can come out as 0 unless you use `bindings.exit(main())`.
- We're on Rust, so this doesn't apply literally. The **general lesson does**: any early `return Ok(())` is an `exit(0)`. Our **owner mode** (`main.rs:76-78`) is exactly that: an early success that skips every output check.
- The page also says to always write tests for the **failure** paths and assert the exact error codes. We currently test 1 success and 1 failure.

### A3. Type ID [S4][S5]
- Type ID is a built-in type script with code hash `0x00…545950455f4944` ("TYPE_ID"), `hash_type: type`.
- Its `args` must be `blake2b(first CellInput of the creating tx ‖ output index)`. A transaction may hold **at most one input and one output** with that Type ID. So only **one live cell** can ever carry a given Type ID, and nobody can mint a second cell with the same identity, because the first input of a tx can only be spent once.
- It has two uses:
  1. **Upgradeable code.** Put the code in a cell with a Type ID and reference it with `hash_type: type`. Whoever controls that cell's **lock** can replace the code. That's a trust assumption to disclose.
  2. **Unique identity** for a state cell, e.g. "this exact subscription".
- **Implication for CadencePay:**
  - Embed Type-ID logic in our own type script. `ckb-std` has a Type ID helper, so we wouldn't need two type scripts. Each Subscription Cell gets an unforgeable ID in `args`, so subscriptions can't be merged or cloned, and the off-chain index can key on the ID.
  - Today the **code** is deployed `data1` with no Type ID (audit §3.10). That makes it **immutable**: no one can upgrade it, and fixes need a new code hash. That's a good trust property; we should keep it and say so.

### A4. Proxy locks: can the type script govern spending? [S6][S7]
`ckb-devrel/ckb-proxy-locks` (listed on the official ecosystem-scripts page) ships small Rust locks. The relevant one:
- **Input Type Proxy Lock**: `args[0..32] = type_script_hash`. It unlocks iff **any input in the tx has a type script with that hash** (`contracts/input-type-proxy-lock/src/entry.rs`, ~15 lines). It checks no signature.
- **Testnet deployment, verified live 2026-10-07:**
  - code hash (data hash): `0x5123908965c711b0ffd8aec642f1ede329649bda1ebdca6bd24124d3796f768a`
  - cellDep: tx `0xb4f171c9c9caf7401f54a8e56225ae21d95032150a87a4678eac3f66a3137b93`, index `1`, `dep_type: code`
  - Recorded in `migrations/testnet/2024-10-08-042300.json`, no Type ID, so immutable.
  - Siblings in the same tx: Output Type Proxy Lock index 2, data hash `0x2df53b…aff2`; Type Burn Lock index 5, data hash `0xff78ba…f53a`.
- **Fit for a Subscription Cell: yes.**
  - Set the cell's lock to Input Type Proxy Lock with `args = hash(cell's own type script)`. There's no circularity, because the type hash doesn't depend on the lock.
  - Spending the cell then always satisfies the lock (the cell itself is an input carrying that type), so **the CadencePay type script becomes the sole authority** over every spend.
  - This solves the audit §3.4 design gap: the merchant (or any keeper) can claim **without the subscriber's key and without a server key**, and the subscriber's other cells stay untouchable.
- **Consequences we must accept:**
  1. The type script must be airtight in every mode, since there's no second line of defence. That means group counts, capacity/payout checks, and cancel authorization.
  2. **Cancel** must prove the subscriber's consent inside the type script. Today's owner-mode idea does this: require an input whose lock hash == subscriber lock hash, which forces the subscriber's signature on that input. It must also constrain outputs: refund to the subscriber, or at least nothing goes to anyone else.
  3. **Fees:** with no server key, the claimer either adds their own input for fees, or the script allows `out_capacity ≥ in_capacity − amount − MAX_FEE`. Pick one and document it.
  4. Type ID in `args` makes each type hash, and so each proxy-lock arg, unique per subscription.
- **Type Burn Lock** (unlocks when a given type is burned) and **Output Type Proxy Lock** aren't needed.

### A5. Time: `header_deps` (RFC 0022) vs `since` (RFC 0017) [S2][S8]

| | `header_deps` | `since` |
|---|---|---|
| Who picks the value | The **tx builder (claimer)** picks any header **already committed** to the main chain (uncles excluded) | The tx builder sets `since` per input; **consensus** checks it |
| What can be faked | Nothing in the future. But the claimer can pick an **older** eligible header. Proves "**at least** block N has happened" | Nothing. The tx can't be mined before the condition holds. But the builder chooses the since **value**, so the **script must read it** (`load_input_since`) and require it to be ≥ the interval, or the claimer just sets 0 |
| Metrics | Header fields: number, epoch, timestamp | Block number, epoch (with fraction), or median timestamp of the previous 37 blocks; **absolute or relative** |
| Relative-to-what | Whatever the script compares against (our `last_claimed_block`) | **The block that created that input cell** |

**Takeaways for CadencePay:**
- Our current check (header number ≥ `last_claimed + interval`) is sound as "at least". The claimer can't claim early.
- **Relative `since` is a neat alternative:**
  - Each claim recreates the cell, so "input cell is ≥ `interval` blocks old" means "an interval has passed since the last claim or creation", and `last_claimed_block` isn't needed at all.
  - Cost: the schedule **drifts** by however late each claim lands, and catch-up claims are impossible.
- **Schedule anchoring choice (feeds threat-model item 10):**
  - (a) Today: `new last_claimed = header.number`. Drifts, and the claimer can pick an older header to delay.
  - (b) `new last_claimed = old + interval`. Fixed schedule, allows catch-up one interval per claim. Needs a real `start_block` at creation instead of 0, otherwise a fresh cell is immediately claimable `tip/interval` times.
  - (c) Strimz-style: drop missed periods [S13].

### A6. Signing with the user's wallet (CCC / JoyID) [S9][S10]
- CCC's model: build a `ccc.Transaction`, then `signer.signTransaction(tx)` or `signer.sendTransaction(tx)`. This is checked against the installed `@ckb-ccc/core` 1.22.0 typings: `Signer.signTransaction(TransactionLike)`, `signOnlyTransaction`, `prepareTransaction`, `sendTransaction`.
- A server-built tx can be shipped as bytes (`tx.toBytes()` → hex) and rebuilt client-side (`ccc.Transaction.fromBytes`). The user's signer then completes and signs it.
- In React: `@ckb-ccc/connector-react` (`ccc.Provider`, `ccc.useCcc()` → `signer`). JoyID comes through `@ckb-ccc/joy-id`, which is already in the demo's `node_modules` as a dependency of `@ckb-ccc/ccc`.
- **Our ground rule** says to use `@ckb-ccc/core` because the `@ckb-ccc/ccc` meta-package breaks Parcel. The demo is Next.js (Turbopack), not Parcel, but `connector-react` is the supported React entry point. Decide in Phase 5.
- **⚠ Risk: COOP header vs JoyID popup.**
  - JoyID signs in a popup window. The demo serves `Cross-Origin-Opener-Policy: same-origin` (`next.config.ts`), and that header severs the reference between the page and popups it opens, which breaks popup-based flows [S11].
  - The header was only needed for KeyWay's **browser** WASM Fiber node. KeyWay 0.1.0 defaults to **managed** mode, which runs no WASM in the page (KeyWay README). So we can likely **drop COOP/COEP**, or use `same-origin-allow-popups`. Test in Phase 5.
- **KeyWay can't sign CadencePay txs** (audit §4): its backend signs Fiber funding txs only. Decision at Checkpoint 1: JoyID signs, KeyWay is login only.

---

## B. Privacy

### B1. What leaks today
A Subscription Cell is public. Its type args hold the **subscriber lock hash**, and its data holds the **recipient lock hash, amount and interval**. Every claim adds a dated payment record. Anyone can list a creator's subscribers, their sizes and their churn, and link a subscriber's subscriptions to their main wallet.

### B2. Obscell: stealth addresses + confidential tokens [S12][S13][S14][S15]
- **What it is:** three CKB scripts by quake. **Stealth Lock** hides the recipient. **CT Info Type** and **CT Token Type** handle confidential token amounts using Pedersen commitments plus Bulletproofs range proofs. There's a TUI wallet (`obscell-wallet`) and a browser wallet (obscell-web.pages.dev, posted 2026-09-23, **testnet only**, all 4 contracts not on mainnet).
- **How stealth works:**
  - The receiver publishes keys `(P, Q')`.
  - The sender makes an ephemeral key, does ECDH with the receiver's view key, and derives a **one-time** public key. The output is locked to that key with Stealth Lock (args: 33-byte point + 20-byte hash).
  - The receiver scans with the view key and spends with the spend key. Verification is delegated to the upstream `ckb-auth` binary through exec.
- **Status caveats, from the author:**
  - "still an early release and may contain bugs"
  - The README says "work in progress and not yet ready for production use"
  - Built largely with AI coding agents ("done in 1 week")
  - The CT parts are **unaudited**. Treat as research-grade.
- **Stealth Lock on testnet, verified live 2026-10-07:**
  - **code hash** `0x0dc965b5bfb6db2759275ad7d92ee502e10955cca789d001af03e3576cfe3f1c`, **`hash_type: type`**. This is a **Type ID**, so **the deployer can upgrade it**: trust assumption.
  - cellDep: tx `0x305a174d8af95368aac1768bf7b1fe7398a6cb6b04808fbbc685300403318428` index `0`. The code cell is live; its lock is secp256k1 args `0x64257f00…20fb`.
  - Needs **ckb-auth** cellDep: tx `0xa0e99b29fd154385815142b76668d5f4ecf30ae85bc2942bd21e9e51b9066f97` index `0` (Type ID `0x0915983b…7021`).
  - Source: `obscell-wallet/config/testnet.toml` and `obscell/deployment/testnet/migrations/2026-02-14-023551.json`. 100+ stealth-lock cells exist on testnet.
- **.cell names:** per the TUI-wallet thread, `.cell` name records (cellula.id) can publish an Obscell stealth address, so a human-readable name (`alice.cell`) resolves to a meta-address while each payment goes to a fresh one-time address. The thread compares this to BIP353. I didn't independently verify cellula.id's record format.

### B3. What stealth payout would mean for CadencePay
- With a **fixed** recipient lock in cell data, claims always pay the same address, so the creator's revenue is fully linkable.
- **Stealth payout:** each claim pays the creator a fresh Stealth Lock output. Our type script then can't check "payout lock == stored lock hash" any more. Instead it must check that **the claim is authorized by the creator**, e.g. a creator signature in the witness verified against a creator pubkey in cell data, via ckb-auth. The payout lock is then the creator's own choice.
- **Trade-offs:**
  - Claims are no longer permissionless; a keeper would need the creator's signature.
  - The creator pubkey stored in every Subscription Cell is itself a **stable identifier**, so this hides **where the money lands**, not **who has subscribers**.
- **Verdict:** a stretch goal at most. A simpler W12 "privacy-lite" is **fresh-address funding** on the subscriber side: the subscriber funds the subscription from a dedicated address, so the cell doesn't link to their main wallet.

### B4. ZK on CKB-VM: SP1 Plonk verifier [S16]
- An optimized `no_std` port of the SP1 **Plonk** verifier for ckb-vm brought verification from about **6,000M to about 63M cycles** (246 KB binary; needs SP1 ≥ v6.0; Groth16 not optimized). Posted 2026-04-01.
- For scale: testnet consensus `max_block_cycles` = **3,500,000,000** (from `get_consensus`), so one verification is about **1.8 % of a block**. That's feasible on-chain.
- **CadencePay future work:** a member proves "I own *a* live Subscription Cell for creator X with amount ≥ tier" without revealing which cell. This could unlock member-only content privately, off-chain or on-chain.
- Not for W11/W12. It needs a membership circuit, a state commitment (e.g. a Merkle root of live subscription cells), and an aggregator.

### B5. BIP352 Silent Payments, for scanning trade-offs [S17]
- The receiver publishes `(B_scan, B_spend)`. The sender derives the output key from ECDH with the **sum of the tx's input pubkeys**, so **no notification output** is needed, and outsiders can't link outputs to the address. Labels let one address separate payment sources.
- **Cost:** the receiver must examine **every eligible transaction**. Light clients need extra per-tx tweak data, so they pay in bandwidth.
- **Relevance:** Obscell-style stealth on CKB puts an ephemeral pubkey in the lock args. That makes scanning cheaper (no input-key summation), but the ephemeral key itself is an on-chain marker that a payment is "a stealth payment". A creator receiving many claims would scan once per block range with the view key.

---

## C. Product

### C1. Strimz (StrimzLab/Strimz, updated 2026-10-06) [S18]
- **What it is:** B2B stablecoin billing on **Arc** (Circle's L1; USDC gas). It offers hosted checkout, subscriptions, invoices and refunds. It's non-custodial in the sense that funds go wallet to merchant.
- **Authorization model:**
  - Checkout uses EIP-3009 signed transfers.
  - Subscriptions use **ERC-20 approve or EIP-2612 permit** plus a signed `SubscriptionIntent(merchantId, token, amount, interval, startAt, endAt, …)`.
  - A `CHARGER_ROLE` scheduler calls charge, and the contract enforces amount and interval (`MIN_INTERVAL = 1 hours`).
- **Missed periods are dropped, not caught up:** `StrimzSubscriptions.sol:407-433`, "we bias predictable billing".
- **Dunning:** an "AutoPay Agent" emails on a merchant-chosen schedule (`once`, `twice`, `until_grace_ends`), and subscriptions have grace periods.
- **Webhooks:**
  - HMAC-SHA256, header **`strimz-signature`**, format `t=<unix>,v1=<hex>`, 5-minute replay window.
  - Events: `payment.created/completed/failed`, `subscription.created/charged/charge_failed/cancelled/lapsed/recovery_attempt/recovery_outcome`, `invoice.created/paid/overdue`, `refund.*`.
- **Fanline** (`apps/demo-merchant`) is their creator-platform demo, with tips and tier subscriptions through hosted checkout. It's the closest analogue to our Patreon demo.
- **Trust comparison** (useful copy for the README and Phase 9 concept 8):

  | | Strimz (allowance) | CadencePay (cell) |
  |---|---|---|
  | Where funds sit | In the payer's wallet. The allowance is often larger than one period, and an ERC-20 approve can even be unlimited | In a dedicated cell funded by the subscriber. The rest of their wallet is out of reach |
  | What limits the merchant | The contract's amount/interval check **and** the size of the allowance | The type script: at most `amount` per `interval`, only from that cell |
  | Failed payments | Possible (insufficient balance or allowance), hence dunning | Impossible while the cell has balance; "dunning" = **low-balance warning plus top-up** |
  | Cancel | Revoke the allowance or call cancel | Spend the cell back to yourself (subscriber signature) |
  | Upgradeability | Immutable contract, with an admin-rotatable registry and a pausable `CHARGER_ROLE` | Immutable `data1` code, no admin |

### C2. Stripe Billing concepts [S19]
- **Product → Price** (amount + interval) → Subscription → Invoice per period → PaymentIntent.
- **Statuses:** `trialing`, `active`, `incomplete`, `incomplete_expired`, `past_due` (latest invoice failed; may retry), `unpaid` (retries exhausted, revoke access), `canceled` (terminal), `paused`.
- **Smart Retries / dunning** are configured per account. The **customer portal** handles self-serve cancel, payment-method updates and invoices. Provision access from the subscription status or entitlements, driven by **webhooks**.
- **Mapping to CadencePay** (derived from chain state, no DB):

  | CadencePay | Condition |
  |---|---|
  | `active` | live cell, balance ≥ next amount |
  | `past_due` | claimable but unclaimed for > N intervals; a keeper issue, not a payer issue |
  | `low_balance` | balance < k × amount; our dunning |
  | `canceled` | cell consumed by the subscriber |
  | `ended` | cell closed at end of life |

### C3. Patreon UX [S20][S21][S22]
- **Creator page:** about section, **tiers** (name, monthly price, description, benefits, cover image), and posts.
- **Post access:** free, all paid members, selected tiers, or pay-per-post.
- Members get a personal **posts feed** across the creators they support, plus a membership page to manage or cancel.
- **What we take:** creator page with tiers, locked/unlocked posts per tier, member feed/dashboard, and creator relationship-manager-lite (a subscriber list).

### C4. Neighbouring CKB/Fiber projects. CadencePay is the L1 primitive underneath them [S23–S26]

| Project (Nervos Talk) | What it is | How CadencePay differs |
|---|---|---|
| **FiberPass** (2026-07-15; Spark 2026-09-02) | Prepaid, revocable **payment sessions** on Fiber. The user funds a per-user vault cell, approves a spending limit, expiry and schedule once, and a payment worker pays recipients through Fiber channels. Their `fiberpass-vault-lock` has an owner-refund path | FiberPass is a session/UX layer whose **per-payment policy runs in an operator worker**. CadencePay puts **amount-per-interval in the type script**, so no operator is needed to enforce the limit |
| **Trickle** (2026-07-15) | Budget-capped **streaming micropayments** on Fiber. An off-chain signed grant `{payee, asset, maxTotal, maxRate, sessionId, nonce, expiry}` (passkey or M-of-N), settled per tick | Off-chain authorization for per-unit metering. CadencePay is **on-chain, per-period** custody-preserving billing. Trickle could settle usage, CadencePay the base subscription |
| **FiberLatch** (2026-05-28; DIS 2026-06-23) | Backend: verify a Fiber payment is **paid**, then issue a **signed one-time access receipt** | The access-control layer. CadencePay **membership-gates content from a live Subscription Cell**, which is a FiberLatch-like gate fed by L1 state |
| **Backr** (2026-04-20) | Patreon-style creator memberships: posts, tiers in CKB, chat. Renewals via **Fiber invoices from the creator's own FNN**, CCC wallet login | The **same product category** as our demo. Backr renews by invoicing each period, so the supporter pays each time or a node coordinates it. CadencePay is the **pull primitive** Backr could use: sign once, the creator claims within limits, no creator node needed |

---

## D. Decisions this research feeds (for Phase 3)
1. **Lock:** move Subscription Cells to **Input Type Proxy Lock** (testnet `0x512390…768a`) so the type script governs. The merchant and keepers claim with **no private key**, and the server key leaves every path except fee payment, which is optional.
2. **Type ID in args**, for unique, unforgeable subscriptions.
3. **Exact group counts** in every mode.
4. **Capacity rule** on claim: `out_cap ≥ in_cap − amount (− max_fee)`, plus a payout output to the stored recipient lock with ≥ amount.
5. **Cancel:** subscriber-lock input required. Leftover goes to the subscriber.
6. **Time:** keep header_deps, add `start_block`, choose anchored vs drifting and the catch-up policy. `since` stays the documented alternative.
7. **Privacy:** document B1 leaks. W12: fresh-address funding. Stealth payout is a stretch (B3). ZK is future (B4).
8. **Frontend:** JoyID via CCC. Drop or relax COOP/COEP.

---

## Sources
- [S1] RFC 0022 Transaction Structure: https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0022-transaction-structure/0022-transaction-structure.md
- [S2] (same RFC, header_deps section)
- [S3] ckb-js-vm Security Best Practices: https://docs.nervos.org/docs/script/js/js-vm-security
- [S4] Type ID docs: https://docs.nervos.org/docs/script/type-id
- [S5] Introduction to CKB Script Programming 6: Type ID (2020-02-03), Nervos docs blog: https://docs.nervos.org/blog (archive)
- [S6] Ecosystem scripts: https://docs.nervos.org/docs/ecosystem-scripts/introduction
- [S7] ckb-proxy-locks: https://github.com/ckb-devrel/ckb-proxy-locks (commit 38b7e1d; `contracts/input-type-proxy-lock/src/entry.rs`, `migrations/testnet/2024-10-08-042300.json`)
- [S8] RFC 0017 Transaction valid since: https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0017-tx-valid-since/0017-tx-valid-since.md
- [S9] CCC docs: https://docs.nervos.org/docs/sdk-and-devtool/ccc
- [S10] `@ckb-ccc/core` 1.22.0 type declarations (local `node_modules`, checked 2026-10-07)
- [S11] MDN-style COOP references: https://http.dev/cross-origin-opener-policy · https://next.centralcsp.com/en/docs/web-security/policies/cross-origin-opener-policy
- [S12] Obscell wallet post: https://talk.nervos.org/t/obscell-wallet-a-privacy-preserving-tui-wallet-for-ckb/9947
- [S13] Obscell web wallet post (2026-09-23): https://talk.nervos.org/t/obscell-web-wallet-ckb/10743
- [S14] https://github.com/quake/obscell (commit 82437e9; `contracts/stealth-lock/README.md`, `deployment/testnet/`)
- [S15] https://github.com/quake/obscell-wallet (commit 1c84247; `config/testnet.toml`)
- [S16] Optimized SP1 verifier for CKB-VM (2026-04-01): https://talk.nervos.org/t/optimized-sp1-verifier-for-ckb-vm/10144
- [S17] BIP352 Silent Payments: https://github.com/bitcoin/bips/blob/master/bip-0352.mediawiki
- [S18] Strimz: https://github.com/StrimzLab/Strimz (commit f5ea06f; `packages/contracts/src/core/StrimzSubscriptions.sol`, `packages/shared-config/src/webhooks.ts`)
- [S19] Stripe, How subscriptions work: https://docs.stripe.com/billing/subscriptions/overview
- [S20] Patreon, Setting post access: https://support.patreon.com/hc/en-us/articles/37807653033997-Setting-post-access-for-your-Patreon-audience
- [S21] Patreon, Editing membership tiers: https://support.patreon.com/hc/en-gb/articles/218202363-How-to-edit-your-membership-tiers-a-guide-for-creators
- [S22] Patreon, Access my benefits: https://support.patreon.com/hc/en-us/articles/204606265-Access-my-benefits
- [S23] FiberPass: https://talk.nervos.org/t/fiberpass-prepaid-revocable-payment-sessions-for-fiber-network/10491 · Spark: https://talk.nervos.org/t/spark-program-fiberpass-spending-permission-infrastructure-for-fiber-network/10679
- [S24] Trickle: https://talk.nervos.org/t/trickle-budget-capped-streaming-micropayments-for-fiber-network/10493
- [S25] FiberLatch: https://talk.nervos.org/t/fiberlatch-live-paid-fiber-testnet-payment-to-signed-access-receipt/10324 · https://talk.nervos.org/t/dis-fiberlatch-access-open-source-access-control-for-fiber-payments/10414
- [S26] Backr: https://talk.nervos.org/t/introducing-backr-creator-memberships-and-paid-content-on-nervos-ckb/10191
- KeyWay repo (for COOP/managed-mode note): https://github.com/officialcmg/ckb-keyway
