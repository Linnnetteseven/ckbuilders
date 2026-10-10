# @cadencepay/sdk v0.3.0

TypeScript SDK for **CadencePay v3**: cell-native recurring payments on CKB testnet. Built on `@ckb-ccc/core`.

- **Subscriber** signs once to create a Subscription Cell, and can top up or cancel at any time.
- **Anyone** (the creator, a keeper, a cron job) can claim at most `amount` every `interval` blocks, paid to the creator. No private key is needed to authorise a claim; the claimer only pays the tx fee.
- Builders return **unsigned** `ccc.Transaction`s. Sign them with the payer's wallet (JoyID via CCC in the browser). On a server, build with `new ccc.SignerCkbScriptReadonly(client, userLock)` and send `tx.toBytes()` to the client.

## Deployment (testnet)

| | Code hash | cellDep |
|---|---|---|
| cadencepay v3 (`data1`) | `0x7c271b62bc4b726f5997f3dbd221cfdbf31c944da19871dc1d8fc3bb75910419` | `0x8acdf7ed…ada8b` #0 |
| Input Type Proxy Lock (`data1`) | `0x5123908965c711b0ffd8aec642f1ede329649bda1ebdca6bd24124d3796f768a` | `0xb4f171c9…7b93` #1 |

Both are exported as `TESTNET`.

## API

| Function | Signed by | Notes |
|---|---|---|
| `buildSubscribeTx({ subscriber, recipientLock, amount, intervalBlocks, prefundPeriods, tip })` | subscriber | Pays the first period to the creator in the same tx (default) and pre-funds `prefundPeriods` more. `amount` ≥ 61 CKB |
| `buildClaimTx({ subscription, recipientLock, tip, keeper })` | keeper (fee only) | Keeper must not be the creator |
| `buildTopUpTx({ subscription, subscriber, addCapacity })` | subscriber | |
| `buildCancelTx({ subscription, subscriber })` | subscriber | Full refund minus fee |
| `buildCloseTx({ subscription, subscriberLock, keeper })` | keeper (fee only) | Only when balance < one period; full refund to the subscriber |
| `findSubscriptions(client, { subscriberLockHash?, recipientLockHash? })` | — | Returns only cells the script would have accepted (forged/legacy cells are ignored) |
| `viewSubscription(sub, tipNumber)` | — | `status`: `active` · `due` · `low_balance` · `closable`, plus `balance`, `periodsRemaining`, `blocksUntilNextClaim` |
| `explainScriptError(message)` | — | Maps script exit codes to names (e.g. `11` → `PayoutMissing`) |

`tip` is `{ hash, number }` from `client.getTipHeader()`.

## Develop

```bash
npm test        # 19 unit tests (node:test via tsx)
npm run build   # tsc → dist/
```

Script tests (46 attack/rule tests) live in `experiments/time-lock-script/tests/src/cadencepay_v3.rs`. Threat model: `notes/cadencepay-threat-model.md`.

**Status:** testnet only, unaudited.
