# W10–W11 Repo Audit (Phase 1, read-only)

**Date:** 2026-10-07 · **Scope:** `reports/`, `experiments/`, CadencePay script + SDK + demo, git history, KeyWay
**Method:** read source, re-ran tests, rebuilt the script from committed source, queried CKB testnet RPC (`testnet.ckb.dev`), scanned full git history (values redacted).
Nothing in the repo was modified except this file.

---

## 0. Urgent: GitHub token in local git config

`git remote -v` shows a GitHub personal access token (`ghp_…`) embedded in the `origin` URL inside **`.git/config`** (local only, never committed: history scan is clean, see §3.11).
It was displayed in this session's tool output, so treat it as exposed.

**Action for Linnette:**
1. Revoke it: GitHub → Settings → Developer settings → Personal access tokens.
2. Remove it from the remote: `git remote set-url origin https://github.com/Linnnetteseven/ckbuilders.git`
3. Authenticate with `gh auth login` (credential helper) or SSH instead of a token in the URL.

---

## 1. Reports

| Week | File | Pushed |
|---|---|---|
| W1–W9 | `reports/ckb_weekly_report_w1.md` … `w9.md` | yes — `HEAD 8f07591` == `origin/main` |
| W10 (Sep 28–Oct 4) | **missing** | late, due Oct 3 |
| W11 (Oct 5–11) | missing (current week) | — |

- No gaps in W1–W9. W9 was pushed in `5f89212` (2026-09-28).
- W9 header says `Period: Sep 22 – Sep 27`; the program week is Sep 21–27. Minor, no action needed.
- **Template**, W5 onward (use this for W10/W11):
  ```
  # CKB Weekly Report — Week N
  **Builder:** Linet Mugwanja
  **Period:** <Mon> – <Sun>, 2026
  **Repo:** github.com/Linnnetteseven/ckbuilders
  ---
  ## What I Built          (1 paragraph)
  ---
  ## <Topic sections>       (code hash / tx / test results / architecture)
  ---
  ## Next (W<N+1>)          (bullets)
  ```
  W1–W4 used a different layout ("Courses / Reading", "What I learned", "Honest note"), and W5 added "Security Observation" and "RFC Reading". Neither format has a dedicated reflections section, so the plan's `<!-- LINNETTE -->` prompts will go under a new `## What I learned / Challenges` heading.

### Factual statements in W9 that the code contradicts
These matter for the W10/W11 reports and the threat model:
- *"Enforces recipient, amount, and interval are unchanged"*: true for the data bytes, but **no capacity or payout is checked**, so claims move no money (§3.5).
- *"Subscriber lock hash used… ownership semantics correct"*: the cells are locked by the **server** key, not the subscriber (§3.4).
- *"401 errors… were Stytch OTP rate limiting"*: the demo runs KeyWay 0.0.1 with no `appId`, and the current backend enforces origins per registered app (§4). Rate limiting may have been real at the time, but the origin/appId mismatch is the structural cause now.
- *"Keeper cron… runs every 2 hours"*: no claim has landed on-chain since **2026-09-28 00:39 EAT** (§3.12).

---

## 2. Experiments inventory

| Folder | What it is | Stack | Tests (run 2026-10-07) | In report |
|---|---|---|---|---|
| `simple-lock-annotated` | **Empty directory, untracked.** Linnette confirmed the annotation exercise was not done. The Simple Lock deploy from W1 isn't on this machine either (searched `~` to depth 8, plus offckb dirs) | — | n/a | W1 mentions the Simple Lock devnet deploy; the code wasn't kept |
| `testnet-transfer` | First testnet CKB transfer via CCC | TS, tsx, **`@ckb-ccc/ccc`** | no test script; typecheck needs pnpm (`devEngines` pnpm ^11.9). **pnpm isn't on PATH in this shell** | W1 |
| `store-data-on-cell` | Docs tutorial: write data to a cell | TS + React + Parcel, `@ckb-ccc/core` | no tests; `tsc --noEmit` passes | W2 |
| `ckb-time-capsule` | Time-capsule dApp (Vercel) | TS + Parcel, `@ckb-ccc/core` | no tests, no tsconfig; strict tsc on `src/*.ts` reports no errors. `.parcel-cache/*.mdb` is **committed**; should be gitignored | W2 |
| `rust-fundamentals/ownership-basics` | Rust ownership exercises | Rust | builds; 0 tests | W1/W2 |
| `error-handling` | Rust enums + `Result` | Rust | builds; 0 tests | W2 |
| `capsule-validator` | Rust CLI validating capsule data | Rust | **5/5 pass** | W3, W4 |
| `capsule-type-script` | Capsule type script on ckb-js-vm | TS → ckb-js-vm, jest + ckb-testtool | mock test **1/1 pass**; **devnet test still excluded** in `jest.config.cjs:5`, deferred since W4 (`w4.md:60-66`) | W4 |
| `time-lock-script` (contract `time-lock`) | Lock script, header_deps timestamp unlock | Rust ckb-std 1.1 | **3/3 pass** | W5 |
| `time-lock-script/contracts/cadencepay` (= "cadencepay-type-script") | CadencePay type script; **no separate folder**, lives inside the time-lock workspace | Rust ckb-std 1.1, ckb-testtool | **2/2 pass**, the only cadencepay tests (valid claim, early claim). **No test for creation, owner/cancel, or any attack** | W6–W9 |
| `cadencepay-sdk` (`@cadencepay/sdk`) | Encode/decode, `createSubscription`, `getSubscriptions`, `canClaim` | TS, `@ckb-ccc/core` | **No tests** (`"test": "echo \"Tests coming in W8\""`). **`tsc` fails**: `src/index.ts:140` TS2345 (`string` vs `` `0x${string}` ``). `package.json` says **0.1.0**, source header says v0.2.0. **Not on npm** (no `@cadencepay/sdk` package) | W7 |
| `cadencepay-demo` | Next.js 16 app, 4 pages + 4 API routes | Next 16.3.5, React 19, `@ckb-keyway/react` 0.0.1 | no tests; `tsc --noEmit` passes; `eslint` **1 error, 5 warnings** | W8, W9 |

Unfinished / loose ends:
- capsule-type-script devnet test (deferred since W4).
- `cadencepay` README is still the template `TODO: Write this readme`.
- Demo **does not use the SDK**: `lib/sdk.ts` is a hand-patched copy, and every API route re-implements encoding inline.
- Demo `package.json` depends on **`@ckb-ccc/ccc`** but every file imports `@ckb-ccc/core`, so it only resolves transitively. This goes against ground rule 7.
- No Molecule serialization yet (W9 "Next" item).
- Cancel button (`app/dashboard/page.tsx:223`) and "Deploy Subscription Tier" (`app/creator/page.tsx:131`) have no handlers. The creator share link points to `/subscribe/<address>`, a route that doesn't exist.
- UI shows a hard-coded tx label `0x44aff6…0307` (`subscribe/page.tsx:113`, `dashboard/page.tsx:106`) that doesn't match the deploy tx `0x5ee7…a3d9`. The creator page says "Settlement: Fiber Network", but settlement is plain L1.

---

## 3. CadencePay deep read

All refs are `experiments/time-lock-script/contracts/cadencepay/src/main.rs` unless stated.

**3.1 Language.** Rust, `ckb-std = "1.1"`, `no_std`/`no_main` (`main.rs:1-12`, `Cargo.toml`). Not ckb-js-vm.

**3.2 Modes and how they're chosen.** Order in `verify()` (`:74-132`):
1. **Owner/cancel** (`:76`, `is_owner_mode` `:41-60`): if **any input in the whole tx** (`Source::Input`, not the group) has lock hash == `args[0..32]`, return `Ok` immediately. **All other checks are skipped**, including outputs.
2. **Creation** (`:81-97`): `load_cell_data(0, GroupInput)` errors, i.e. no subscription cell is being consumed.
3. **Claim** (`:99-130`): `GroupInput[0]` exists.
There is no explicit cancel/close mode beyond the owner bypass.

**3.3 Data layout.** 56 bytes, **manual little-endian bytes, not Molecule** (`:14-22`, `parse_data` `:62-72`):
`[0..32] recipient_lock_hash | [32..40] amount u64 | [40..48] interval_blocks u64 | [48..56] last_claimed_block u64`.
Args: `[0..32] subscriber_lock_hash`. The length check is `< 56` (`:63`, `:87`, `:113`), so **longer data is accepted** and trailing bytes are unchecked.

**3.4 Which lock guards a Subscription Cell?**
- **Demo (what's on-chain):** the **server's secp256k1 key** (`app/api/subscribe/route.ts:47-48,76`: `lock: serverLock`). The server also **funds** the cell (`:80` `completeInputsByCapacity(signer)` with the server signer). All 6 live cells on testnet are locked by `secp256k1 args 0x5cb8098824…`, **the same key that deployed the script** (deploy tx output 0 lock).
  - Who can spend: only the server key holder.
  - How does the "merchant" claim without the subscriber? The server holds the lock, so no subscriber signature is involved anywhere.
  - Can the subscriber cancel? **No.** Owner mode needs an input with the subscriber's lock, but the cell's own lock still needs the server's signature. Cancelling needs both parties, and the demo has no cancel route.
- **SDK (`cadencepay-sdk/src/index.ts:168-175`):** locked by the **subscriber's** lock. That's correct custody, but then **the merchant can never claim**: claim needs the lock to unlock, which needs the subscriber's signature. The SDK has no claim builder.
- **The protocol currently has no lock design that lets the merchant claim without the subscriber's key.** That's the question for Phase 2 (Input Type Proxy Lock or similar).

**3.5 Claim validation.**
- **Payout lock: not checked at all.** `recipient_lock_hash` is stored but never read. There's no merchant output check, and no comparison of **input vs output capacity**.
  - Consequence: whoever can unlock the cell can set the output capacity to the occupied minimum and take the rest in one "claim".
  - In the demo, `app/api/claim/route.ts:99-104` keeps the same capacity and the same server lock, so **no CKB ever moves to the creator**. A claim only bumps `last_claimed_block`.
  - On-chain: all 6 cells still hold exactly **200 CKB**.
- **Interval elapsed:** `load_header(0, HeaderDep).number >= last_claimed + interval` (`:103-109`). Only header_dep **index 0** is read. `last_claimed + interval` is a plain `+` with `overflow-checks = true` (`time-lock-script/Cargo.toml` release profile), so a huge `interval` makes the script **panic** rather than return an error code.
- **New `last_claimed_block`:** must equal the header_dep's block number (`:122-127`). So it **is derived from the header**, not free data. But the **claimer picks which header**: any committed header ≥ `last + interval`. The claimer can't jump ahead to a future block, but can pick an older eligible header, which delays the next due date and enables sequential catch-up (§3.8).

**3.6 Group counting.** **None.** Only index 0 of GroupInput and GroupOutput is ever loaded (`:81`, `:85`, `:111`). Consequences:
- **Claim, 2 in → 1 out:** two subscriptions are merged and one disappears; its capacity goes wherever the lock holder wants.
- **Claim, 1 in → 2 out:** output #2 can carry arbitrary data, e.g. `last_claimed = 0` or a different amount. That forges a second, immediately claimable subscription.
- **Creation, 0 in → N out:** only output 0 is validated. Outputs 1..N are unchecked.

**3.7 Create-mode validation.** Minimal (`:82-96`): only `len ≥ 56` and `last_claimed == 0`. Not checked:
- `amount > 0`, `interval > 0` (`interval = 0` means claimable every block)
- `recipient_lock_hash` ≠ zero
- `args.len() == 32`. Anyone can create a cell with **any** subscriber hash in args, for example a victim's.
- capacity ≥ amount
- Type ID / uniqueness

**3.8 Low remaining capacity.** Not handled. Capacity is never decremented, so this path is never reached today. Once payouts are enforced, the last claim fails when `capacity - amount < occupied`, and there's no close or sweep mode yet.
**Catch-up:** one claim per tx, but the claimer can chain claims with headers at `last+interval`, `last+2·interval`, … to catch up over several txs.

**3.9 Demo app.**
- **Private key usage:** `CKB_PRIVATE_KEY` → `ccc.SignerCkbPrivateKey` in:
  - `app/api/subscribe/route.ts:6,44`: **signs**; funds and locks the cell with the server key.
  - `app/api/claim/route.ts:6,17`: **signs**; also pays fees.
  - `app/api/subscriptions/route.ts:5,14`: **doesn't sign**, but loads the key just to derive the server lock for the query. A read-only route doesn't need the secret; it could use the lock or address.
- **Client bundle:** no key is reachable.
  - `CKB_PRIVATE_KEY` is not `NEXT_PUBLIC_`, and it's read only in server route files.
  - `.env.local` defines only `NEXT_PUBLIC_CADENCEPAY_CODE_HASH` and `_TX_HASH` (names checked, values not printed). The key and `CRON_SECRET` must live only in Vercel env.
  - All 485 64-hex strings in the local `.next/static` build are library constants also present in `node_modules`, or the public code hash.
- **App-layer issues for the threat model:**
  - **`/api/subscribe` is unauthenticated and server-funded.** Anyone can POST repeatedly and lock 200 CKB of the server wallet per call. Those funds can't be recovered without the matching subscriber key (§3.4).
  - **`/api/claim` is unauthenticated.** Anyone can make the server pay claim fees, and it trusts `cellDataHex` from the client (`:65`) for its pre-check. The script still checks the real input.
  - `/api/cron/claim` compares against `` `Bearer ${process.env.CRON_SECRET}` `` (`route.ts:5`). **If `CRON_SECRET` is unset, the header `Bearer undefined` passes.** Verify it's set in Vercel.
  - The dashboard lists **all** server-owned cells for every user. It doesn't filter by the logged-in subscriber.
  - No rate limiting and no input validation (BigInt of arbitrary strings, address parsing errors returned verbatim).

**3.10 Deployed code hash vs source.** ✅ **Match.**
- `build/release/cadencepay` (Sep 21 22:01) hashes to `0x05d60806…6fb4`.
- A fresh rebuild of committed `HEAD` source in a scratch dir (`make build CONTRACT=cadencepay CLANG=clang-16`, rustc 1.96.1) also gives **`0x05d60806d86b478715633f846d2e4d31e60b95b4ea0af4f5ce6c72e19d4b6fb4`**.
- On-chain deploy tx `0x5ee7b1ea…a3d9` is **committed**. Output 0 is 40,792 bytes with the same blake2b hash.
- `hash_type: data1`, **no Type ID** on the code cell. The code is immutable: no one can upgrade it, so fixes need a new code hash and new cells.
- The code cell is locked by the deployer key. If that key consumes the cell, the cellDep breaks until someone redeploys the identical binary.
- Note: `make build` needs `CLANG=clang-16` on this machine; `scripts/find_clang` only searches for clang 19+.

**3.11 Leaked keys in git history.** ✅ **Clean.**
- Scanned `git log -p --all` (41 commits) for 64-hex strings on lines with key/secret/private/mnemonic/seed/signer, GitHub tokens, AWS/OpenAI keys and PEM headers.
- Only hit: `experiments/capsule-type-script/.env.example` L4, commit `fd051fa`, `PRIVATE_KEY=` an **all-zeros placeholder**. Not a leak.
- `.env`, `.env.local` and `.env*` are gitignored (root and per-project) and none are tracked.
- **The exception is the GitHub PAT in `.git/config` (§0)**: not in history, but exposed locally and in this session.

**3.12 On-chain state** (tip 22,664,562 @ 2026-10-07 17:18 EAT). 6 live CadencePay cells, all with the same subscriber args `0x60011fff…`, 5 CKB / 2000 blocks, server-locked, 200 CKB each:

| Cell tx | Created block | last_claimed |
|---|---|---|
| 0xd9b32a4a… | 22,494,682 (Sep 21) | 22,494,678 |
| 0x836d6248… | 22,510,181 (Sep 23) | 0 |
| 0xedc63497… | 22,510,188 (Sep 23) | 0 |
| 0x50f90fc2… | 22,510,196 (Sep 23) | 0 |
| 0x47f9a872… | 22,510,216 (Sep 23) | 22,510,213 |
| 0x70d2049b… | 22,559,988 (**Sep 28 00:39**) | 22,559,985 |

Every cell is claimable now, yet **nothing has been claimed since Sep 28 00:39**, so the keeper cron isn't working. **Root cause, confirmed 2026-10-07 from Linnette's Vercel dashboard: the keeper cron was never deployed.**
- The live Production deployment is **`b574cee` (Sep 21, Ready)**. That commit has no `app/api/cron/claim` route, and its `vercel.json` has no `crons` key. The cron arrived in `2b2d41c` (Sep 28 00:33).
- The only Sep 28 deploy, a CLI upload of 31 files labelled `b574cee`, **failed in 1s**: `The specified Root Directory "experiments/cadencepay-demo" does not exist`. The CLI was run from inside the demo folder, so only that folder was uploaded, while the project setting expects the repo-root layout.
- The Sep 28 pushes (`2b2d41c`, `72aad95`, `5f89212`, `8f07591`) show **no Git-triggered deployments** in the list. Check that the GitHub integration is still connected.
- Even after a successful build, the **Hobby plan** only allows daily crons. `0 */2 * * *` has to become daily (e.g. `0 6 * * *`), or the deploy will be rejected.
- `CRON_SECRET` **is set** (Production, sensitive, added Sep 28), so the `Bearer undefined` bypass doesn't apply in production. Once deployed, the route checks it correctly. It should still add an `!cronSecret` guard, as Vercel's own example does.
- `CKB_PRIVATE_KEY` is sensitive and Production-only.
- Deployment Protection (Vercel Authentication) is **on**. With "Standard" protection the production domain is public. With "All deployments", the cron route's internal `fetch` to `/api/subscriptions` and `/api/claim` would hit the login wall. Better to call the logic directly than fetch the app's own URL.
- **Fix belongs in Phase 5/6, after the Phase 4 script fixes.** A working cron would start sending server-key claims that move no money.
- Since production is the Sep 21 build, the on-chain claim at Sep 28 00:39 must have come from the dashboard "Trigger Claim" button or a local run, not from the cron.

The W9 report lists 3 cells by short hash, and only `0xd9b32a4a…` is still live under that hash; claims re-create the cell under a new outpoint.

---

## 4. KeyWay

- **Installed:** `@ckb-keyway/react` **0.0.1** (npm, `package-lock.json`). Used only via `<KeyWayProvider appName theme>` (`app/providers.tsx:6`), with **no `appId`**.
- **Latest:** **0.1.0** on npm, published 2026-10-06. Repo: github.com/officialcmg/ckb-keyway. Versions 0.0.2–0.0.7 and 0.1.0 all came out between Sep 25 and Oct 6.
- **Relevant changes** (repo log + README):
  - `303acf7` (Oct 6): separate auth / CKB account / Fiber APIs. `autoConnect` now defaults to `false`, and there's a new `useCkbWallet()`.
  - `4a1a4ac` (Sep 29): managed native Fiber node is now the default (`nodeMode="managed"`). Browser WASM is opt-in.
  - **App registration:** create an app at ckb-keyway.vercel.app/dashboard, register exact origins, and pass `appId="keyway_…"`.
- **Is the 401 / origin issue addressed?**
  - The backend now checks `Origin` against the **app's registered origins** when an `appId` is sent. Without one, it falls back to the KeyWay operator's own `KEYWAY_ALLOWED_ORIGINS` (`src/server/http.ts:357-363`). An unregistered origin gets **403 "Origin is not allowed"**.
  - Our 0.0.1 sends no `appId`, so `cadencepay-demo.vercel.app` depends on the KeyWay operator's env list.
  - **Fix (Phase 5):** upgrade to 0.1.0, register `https://cadencepay-demo.vercel.app` and `http://localhost:3000`, and pass `appId`. That's in our hands now, so we no longer depend on the dev.
- **🚩 Blocker for Phase 5 ("subscriber signs via KeyWay"):**
  - 0.1.0 exports `RemoteCkbSigner` (a CCC `SignerCkbPublicKey`), but the backend's `/api/keyway/sign-transaction` route **only signs Fiber channel-funding transactions**. `src/server/funding-transaction.ts:27-93` enforces:
    - exactly one channel-funding output, "Only CKB channel funding is allowed"
    - **no header_deps**
    - expected output data
    - funding and fee caps
  - A CadencePay subscribe tx (Subscription Cell output) or cancel tx will be **rejected by design**. The allowlist isn't the issue.
  - **Options:**
    - (a) **JoyID via CCC** as the subscriber signer, the plan's fallback, which becomes the primary path.
    - (b) Keep KeyWay for email login and identity only, with JoyID signing.
    - (c) Ask the KeyWay dev for a policy that allows signing txs whose only non-change output carries an allow-listed type script (CadencePay code hash). That's a feature request, not a bug.
- **Also relevant:** KeyWay's production deployment requires COOP/COEP headers. The demo's `next.config.ts` already sets them (commit `b574cee`). These headers can break JoyID's popup/iframe flow, so test that in Phase 5.

---

## Decisions at Checkpoint 1 (2026-10-07)
- Signing: **option (a)**. JoyID via CCC signs subscribe and cancel; KeyWay 0.1.0 handles email login and identity only. Linnette will **also** raise option (c) with the KeyWay dev: a policy to sign txs whose only non-change output carries the CadencePay type script.
- `simple-lock-annotated`: the exercise wasn't done. Don't report it as an experiment.

---

## Decision at Phase 5 start (2026-10-07)
- **KeyWay dropped for now.** Its builder is rewriting it, so we can't rely on it. Login **and** signing use **JoyID via CCC**. COOP/COEP headers (needed only for KeyWay's browser WASM node) are removed, which also unblocks JoyID's popup. JoyID onboarding is a passkey, not email OTP; still no seed phrase.

---

## 5. Summary of severity (input to Phase 3)

| # | Finding | Severity |
|---|---|---|
| 1 | Server key funds and locks every Subscription Cell. No subscriber custody, no subscriber cancel | High |
| 2 | Claim checks no capacity and no payout. The lock holder can drain, and the creator is never paid | High |
| 3 | No group counting: merge (2→1) and forge/split (1→2, 0→N) | High |
| 4 | Owner mode bypasses all checks if any tx input has the subscriber lock | Med |
| 5 | Create mode accepts interval 0, amount 0, zero recipient, arbitrary args; no Type ID | Med |
| 6 | No lock design yet that lets the merchant claim without the subscriber's key | High (design) |
| 7 | Unauthenticated `/api/subscribe` drains the server wallet; `/api/claim` drains fees; possible `Bearer undefined` cron bypass | Med |
| 8 | Keeper cron never deployed: prod is the Sep 21 build, the Sep 28 deploy failed on Root Directory, Hobby allows daily crons only | Med (ops) |
| 9 | KeyWay 0.0.1, no appId → origin rejection; KeyWay can't sign CadencePay txs | High (blocks Phase 5 plan) |
| 10 | SDK doesn't compile, has no tests, isn't published; demo doesn't use it | Med |
| 11 | `u64` overflow panics instead of returning an error code | Low |
| 12 | GitHub PAT in `.git/config`, exposed in this session | High (rotate now) |
