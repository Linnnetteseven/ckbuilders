# CadencePay Threat Model (Phase 3)

**Date:** 2026-10-07 · **Scope:** type script `experiments/time-lock-script/contracts/cadencepay/src/main.rs` (deployed `0x05d60806…6fb4`, `data1`), `@cadencepay/sdk`, `cadencepay-demo`.
**Inputs:** `notes/w10-w11-audit.md` (findings), `notes/research-security-privacy.md` (design options).
**Status key:** OK · **broken** (exploitable or wrong today) · **not handled** (no code path).

## Target design (assumed by the fixes below)
- **Lock:** Input Type Proxy Lock (testnet code hash `0x5123908965c711b0ffd8aec642f1ede329649bda1ebdca6bd24124d3796f768a`, `data1`, cellDep `0xb4f171c9…7b93#1`), with `args = hash(own type script)`. The **type script is the sole authority** over spends.
- **Type args:** `type_id[32] ‖ subscriber_lock_hash[32]`.
- **Data, v3:**
  - `recipient_lock_hash[32]`
  - `amount u64`
  - `interval_blocks u64`
  - `next_claim_block u64`. This replaces `last_claimed`: the first claim is due at `start + interval`, so the anchored schedule needs no zero-start special case.
  - Manual little-endian bytes stay (Molecule is optional; decide in Phase 4).
- **Modes, selected explicitly by group shape:**

| Mode | Group in → out | Authorization |
|---|---|---|
| **create** | 0 → 1 | Type ID |
| **claim** | 1 → 1 | none (permissionless keeper) |
| **cancel** | 1 → 0 | input with `subscriber_lock_hash` |
| **top-up** | 1 → 1 | input with `subscriber_lock_hash`, capacity increases, data identical |
| **close** | 1 → 0 | permissionless when balance < amount; remainder refunded to the subscriber |

  Any other shape → error.

---

## Threat table

| # | Threat | Sev | Evidence | Status | Fix | Proving test(s) |
|---|---|---|---|---|---|---|
| 1 | **Custody:** the server key funds **and** locks every Subscription Cell. The subscriber neither pays nor controls it, and can't cancel | **High** | `cadencepay-demo/app/api/subscribe/route.ts:44-48,76,80`. All 6 testnet cells are locked by deployer key args `0x5cb80988…` | **broken** | Subscriber funds the cell and signs creation with **JoyID via CCC**. Lock = Input Type Proxy Lock. The server only *builds* the unsigned tx. The server key is removed from subscribe, cancel and subscriptions | SDK: `buildSubscribeTx` output lock is the proxy lock, inputs come only from the subscriber. Demo e2e: subscribe on testnet with JoyID, with no `CKB_PRIVATE_KEY` set |
| 2 | **Spend authority:** whoever holds the lock can claim, and claim mode checks no capacity, so the lock holder can **drain** the cell. With the SDK's subscriber lock, the merchant **can't claim at all** | **High** | `main.rs:99-130` (no capacity read). `cadencepay-sdk/src/index.ts:168-175` | **broken** | Proxy lock + rule #6. The merchant/keeper can only move `amount` to the recipient per interval. Cancel needs the subscriber (#7) | `claim_rejects_output_capacity_drop_gt_amount`, `claim_allows_keeper_without_any_signature`, `spend_rejects_without_type_rules` (try to spend with a different group shape) |
| 3 | **header_deps trust:** the claimer picks the header | Med | `main.rs:103-109,122-127` | **OK (partial).** `last_claimed` *is* header-derived and the claimer can't claim early. But an older header can delay the schedule, only `HeaderDep[0]` is read, and `+` panics on overflow | Anchored schedule: require `header.number ≥ next_claim_block` and set `new next_claim = old next_claim + interval` (no free choice). Use `checked_add` and return an error code. Reject `interval == 0` at creation | `claim_rejects_header_before_next_claim`, `claim_rejects_next_claim_not_advanced_by_interval`, `create_rejects_interval_overflow` |
| 4 | **Group counting:** claim reads only index 0, so **2→1 merges** and **1→2 splits/forgeries** pass. Creation validates only output 0 | **High** | `main.rs:81,85,111`. The subscriber hash in args puts one subscriber's subs in one group | **broken** | Count `GroupInput` / `GroupOutput` first, and map counts to modes (table above). Anything else is an error. Type ID also makes each subscription its own group | `claim_rejects_two_inputs_one_output`, `claim_rejects_one_input_two_outputs`, `create_rejects_two_outputs` |
| 5 | **Immutable fields:** `[0..48]` of the data is checked, but **capacity, lock, type, and trailing bytes** are not. Data longer than 56 bytes is accepted | **High** | `main.rs:113-120` (`len < 56`, `[..48]` compare) | **broken** | On claim: output **lock and type hash equal the input's** (`load_cell_lock_hash` / `load_cell_type_hash`). Data length **exactly** = size. All fields equal except `next_claim`. `out_cap == in_cap − amount` (or `≥ in_cap − amount − MAX_FEE` if the fee comes from the cell; see #6) | `claim_rejects_changed_recipient`, `claim_rejects_changed_amount`, `claim_rejects_changed_lock`, `claim_rejects_extra_data_bytes` |
| 6 | **Payout correctness:** `recipient_lock_hash` is never read, so no payment reaches the creator. In the demo the CKB stays on the server lock | **High** | `main.rs` never reads `[0..32]`. `app/api/claim/route.ts:99-104`. All 6 cells still hold exactly 200 CKB | **broken** | Claim must include an output with `lock_hash == recipient_lock_hash` and `capacity ≥ amount`, counted by summing all such outputs (fee policy decides). **Fee policy (proposed):** the keeper pays the fee from their own input, so `out_cap == in_cap − amount` exactly. That's simplest to verify and leaves the subscriber's balance predictable | `claim_rejects_missing_payout`, `claim_rejects_payout_below_amount`, `claim_rejects_payout_to_other_lock`, `claim_valid_pays_recipient` |
| 7 | **Cancel authorization:** any input with the subscriber lock → **skip all checks** (outputs unconstrained). In the demo the subscriber also can't cancel (server lock) | Med | `main.rs:41-60,76-78`. No cancel route; `dashboard/page.tsx:223` has no handler | **broken / not handled** | Cancel = group 1→0, requires an input whose lock hash == `args[32..64]`. The secp/JoyID signature on that input is the authorization. Leftover CKB goes to an output with the subscriber lock (sum ≥ `in_cap − MAX_FEE`). No early `return Ok` anywhere | `cancel_requires_subscriber_input`, `cancel_rejects_refund_to_other_lock`, `cancel_valid_refunds_subscriber`, `owner_input_cannot_rewrite_subscription` (1→1 with a subscriber input but changed data → rejected unless it's a valid top-up) |
| 8 | **Forged cells:** anyone can create a cell with this type, with **any subscriber hash, interval 0, amount 0, zero recipient** | Med | `main.rs:82-96`. `app/api/subscriptions/route.ts` lists every cell under the server lock | **broken** | Create mode checks: Type ID args valid; `amount > 0`; `interval ≥ MIN_INTERVAL` (e.g. 100 blocks); recipient ≠ 0; `capacity ≥ occupied + amount`; **lock == Input Type Proxy Lock(own type hash)**; and **subscriber lock input present** (the subscriber funds and consents). Off-chain: index by code hash and re-validate decoded fields; drop invalid cells | `create_rejects_bad_type_id`, `create_rejects_zero_interval`, `create_rejects_zero_amount`, `create_rejects_wrong_lock`, `create_rejects_without_subscriber_input`; SDK `getSubscriptions_ignores_invalid_cells` |
| 9 | **Low balance / end of life:** no logic. Once payouts are enforced, the last claim fails when `in_cap − amount < occupied`, and capacity sits stranded | Med | none | **not handled** | **Close mode:** when `in_cap − amount < occupied` (can't fund another full claim), anyone may pay the final `min(amount, in_cap − occupied)` to the recipient if due and refund the rest to the subscriber (1→0). UI shows `low_balance` once remaining < 2 × amount, and **top-up** mode lets the subscriber add capacity (1→1, data unchanged, `out_cap > in_cap`, subscriber input required) | `close_pays_final_and_refunds_subscriber`, `close_rejects_while_balance_sufficient`, `topup_requires_subscriber_input`, `topup_rejects_data_change` |
| 10 | **Catch-up claims:** if 3 intervals have passed, how much can the merchant take? | Low | today: one claim per tx, `last = header`, so it drifts with no catch-up | **decision needed** | **Proposal:** with the anchored schedule (#3), each claim pays one interval, and the keeper may submit sequential txs to catch up (bounded by the cell balance). That's honest: the subscriber pre-funded those periods and never cancelled. One claim per tx, at most one `amount` per tx. Document it in the README trust copy. (The Strimz alternative is dropping missed periods.) | `claim_catchup_three_sequential_txs`, `claim_rejects_double_amount_in_one_tx` |
| 11 | **Upgradeability:** what if the code changes under users? | Low | Deploy tx `0x5ee7…a3d9` output 0, `data1`, no Type ID. The code cell is locked by the deployer key | **OK**: immutable. **Risk:** if the deployer consumes the code cell, the cellDep breaks until anyone redeploys the identical binary | Keep `data1`, no Type ID. Disclose "no admin, no upgrade". Document how to redeploy the identical binary (reproducible build already confirmed: same hash from rustc 1.96.1 + clang-16). Mention that Stealth Lock / proxy-lock dependencies have their own trust (proxy lock = `data1`, immutable) | Reproducible-build check: rebuild → hash == deployed (scripted in README) |
| 12 | **Privacy:** the cell publicly links subscriber ↔ creator ↔ amount ↔ schedule, and every claim is a public dated payment | Med | type args + data layout. Research B1 | **not handled** (inherent) | Disclose in README "Known limitations". **W12:** fresh-address funding (subscriber funds from a dedicated JoyID sub-account/address). **Stretch:** stealth payout via Obscell (needs creator-signed claims; research B3). **Future:** SP1 ZK membership proof (research B4) | n/a (documentation). For fresh-address: demo e2e shows the subscription funded from an address with no other history |
| 13 | **App layer:** unauthenticated `/api/subscribe` spends the server's 200 CKB per call. Unauthenticated `/api/claim` burns server fees and trusts client `cellDataHex`. `/api/subscriptions` loads the private key just to derive a lock. The dashboard shows *all* cells to every user. No rate limit or input validation. Cron route missing the `!cronSecret` guard. COOP header may break JoyID | Med | `subscribe/route.ts`, `claim/route.ts:65`, `subscriptions/route.ts:14`, `cron/claim/route.ts:5`, `next.config.ts` | **broken** | After #1, subscribe/cancel routes only **build** unsigned txs (no key = nothing to drain). Validate inputs (address parse, bigint ranges, outpoint format). Claim/keeper reads cell data from chain, never the client. Cron: `if (!secret ‖ auth !== Bearer secret) 401`, daily schedule (Hobby), call logic directly instead of self-fetch. Filter the dashboard by the logged-in subscriber lock hash. Relax COOP to `same-origin-allow-popups` (or drop it; KeyWay managed mode). The keeper fee key, if any, gets a tiny balance and a separate env var `KEEPER_FEE_KEY`, server-only | Route unit tests (invalid input → 400). `grep` CI check: no `PRIVATE_KEY` in `app/**/page.tsx` or `components/`. Client-bundle scan (Phase 1 script) in the Phase 8 checks |
| 14 | **Leaked secrets:** history is clean (only an all-zeros placeholder), but a **GitHub PAT is embedded in `.git/config`** and was displayed in this session | **High** | audit §0, §3.11 | **broken until rotated** | Linnette revokes the PAT, `git remote set-url origin https://github.com/Linnnetteseven/ckbuilders.git`, uses `gh auth login`/SSH. Re-run the history scan before each push (Phase 8) | Phase 8: `git config --get remote.origin.url` contains no `@`. Staged-diff secret scan is clean |

### Extra findings (not in the plan's list)
| # | Threat | Sev | Fix |
|---|---|---|---|
| 15 | **Type ID / subscriber hash in args are unvalidated:** args shorter than 32 bytes → `is_owner_mode` returns false silently. Any length is accepted | Low | Require `args.len() == 64` exactly |
| 16 | **Demo-only stuck funds:** the 6 legacy cells (1,200 CKB) need **both** the server key (lock) and a subscriber-lock input (owner mode) to recover, or a server-signed claim that re-creates them (they can't be destroyed in claim mode) | Low (testnet) | One-off recovery tx in Phase 4/5: the server key spends, and the subscriber `0x60011fff…` adds an input for owner mode. Needs the KeyWay-PKP account's signature, which KeyWay won't give for non-funding txs. **If that's impossible, write them off as testnet loss and document it** |
| 17 | **Keeper liveness:** the cron was never deployed; Hobby allows daily only | Med (ops) | Phase 5/6: daily cron, deploy fix, plus a "Claim now" button for the creator (permissionless claims mean anyone can run a keeper) |
| 18 | **Cancel front-runs a due claim:** the subscriber can cancel after a period is due but before the keeper claims, so the creator loses at most one period | Low | SDK/demo `buildSubscribeTx` pays the **first period directly to the creator inside the subscribe tx** and sets `next_claim = tip + interval`. Residual: at most one unclaimed period. Documented in the README |
| 19 | **Payout below minimum cell size:** a standalone output needs ~61 CKB. Smaller `amount`s can only be claimed by the creator merging the payout into their own cell (net accounting makes this safe; test `claim_valid_creator_merges_small_payout_into_own_cell`) | Low | **Tiers must be ≥ 61 CKB** (secp payout cell). Creator-merge claims don't work in practice: the fee comes from the creator's own funds, so their net drops below `amount`. SDK `buildSubscribeTx` refuses smaller amounts. Demo tiers ≥ 100 CKB. Future: allow a capped keeper fee out of the payout |

---

## Phase 5 status (2026-10-07), demo code
- **#1 custody: fixed in code.** `/api/subscribe` (server-funded, server-locked) deleted. Subscribe, top-up and cancel are built client-side with `@cadencepay/sdk` and **signed by the subscriber's own wallet (JoyID via CCC)**. `CKB_PRIVATE_KEY` is referenced nowhere in the app.
- **Claim signer decision:** no merchant key at all. With the proxy lock anyone may claim, so the server keeper holds only `KEEPER_FEE_KEY` to **pay fees** (a fresh key with a small balance, server-only, read in `lib/keeper.ts` and used only by route handlers). Why not "creator signs from dashboard": the creator is the recipient, and a fee paid from the recipient's own cells drops their net payout below `amount` (#19), so the fee payer must be a different lock anyway. Leak impact: its fee balance only.
- **#13 app layer: fixed in code.** `/api/subscriptions` deleted (pages read chain directly). `/api/claim` validates input, reads the cell from chain (ignores client data), checks the recipient address matches the terms, only pays when due, and is rate-limited per instance. Cron requires a non-empty `CRON_SECRET`, runs daily (Hobby), calls the keeper directly (no self-fetch). COOP/COEP removed (JoyID popup). The dashboard shows only the connected subscriber's cells.
- KeyWay removed (being rewritten upstream).
- Verified: `next build` OK, lint 0 errors, no keeper strings or unexplained 64-hex in the client bundle, smoke test (pages 200, bad input → 400, cron without secret → 401, non-subscription cell → 400).
- **Pending:** live testnet e2e with JoyID (subscribe → claim → top-up → cancel), Vercel env + deploy fix.

## Phase 4 status (2026-10-07)
Script v3 implemented test-first: **46 cadencepay tests + 3 time-lock = 49/49 pass**. Fixed: #2 #3 #4 #5 #6 #7 #8 #9 #10 #15. Pending deploy (Linnette). Code hash `0x7c271b62…0419`.

## Decisions at Checkpoint 3 (2026-10-07, Linnette: "go with your recommendation")
- #10 catch-up: **anchored schedule**, one `amount` per claim tx, sequential catch-up allowed.
- #6 fee: **keeper/creator pays the fee from their own input**, so the cell drops by exactly `amount`.
- W11/W12/future split approved as below.

## Proposed schedule

**W11 (now → Sun Oct 11): make it correct and custody-true**
- Script v3, tests first (Phase 4): #2, #4, #5, #6, #7, #8 (incl. Type ID), #3 (anchored + checked_add), #15. Also #9 top-up + close, since close is small once #6 exists.
- Linnette deploys v3 to testnet with the proxy lock. Record in `notes/deployments.md`.
- SDK 0.3.0 + tests (build subscribe/cancel/claim/top-up txs, validating decoder).
- Demo (Phase 5): #1 subscribe and cancel signed by JoyID, #13 route hardening, COOP fix, dashboard filtered by user.
- #14 PAT rotation (Linnette, today).

**W12 (Oct 12–18): user-ready + submission**
- Phase 6 pages (creator page, gated posts, member/creator dashboards, receipts), #17 keeper/cron fix + deploy fix, #10 documented, #11 README trust copy and reproducible-build script, #12 privacy section + fresh-address funding, #16 legacy-cell decision, final report + grant prep.

**Future**
- Stealth payout via Obscell (#12 stretch; needs creator-signed claims), signed webhooks (Strimz-style `t=,v1=` HMAC), Molecule schema, SP1 ZK membership proofs, mainnet (blocked on an audit).
