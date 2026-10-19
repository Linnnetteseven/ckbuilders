# cadencepay

Recurring payments on [CKB](https://www.nervos.org/) where the payer keeps custody.

A member funds their **own** subscription cell. The creator (or anyone) can collect **at most the agreed amount, once per period**, and it's always paid to the creator. The member can top up or cancel any time and get the rest back. These rules are enforced on-chain by the CadencePay v3 type script, not by a server.

- Docs and quickstart: https://cadencepay-demo.vercel.app/docs
- Live demo: https://cadencepay-demo.vercel.app/app
- **Status:** CKB testnet only, unaudited

## Install

```bash
npm install cadencepay @ckb-ccc/core
```

## 30-second example

```ts
import { ccc } from "@ckb-ccc/core";
import { buildSubscribeTx, findSubscriptions, viewSubscription, buildCancelTx } from "cadencepay";

const client = new ccc.ClientPublicTestnet();
const signer = /* the member's CCC signer, e.g. JoyID via @ckb-ccc/connector-react */;
const creator = await ccc.Address.fromString("ckt1...creator", client);
const tip = await client.getTipHeader();

// Join: pays 100 CKB to the creator now and saves 3 more payments in the member's own cell
const tx = await buildSubscribeTx({
  subscriber: signer,
  recipientLock: creator.script,
  amount: 100n * 100_000_000n,   // shannons
  intervalBlocks: 450n,          // ~1 hour on testnet
  prefundPeriods: 3n,
  tip: { hash: tip.hash, number: tip.number },
});
const txHash = await signer.sendTransaction(tx);

// Read memberships straight from the chain (no database)
const { script: me } = await signer.getRecommendedAddressObj();
const subs = await findSubscriptions(client, { subscriberLockHash: me.hash() });
console.log(viewSubscription(subs[0], tip.number).status); // "active" | "due" | "low_balance" | "closable"

// Cancel: everything left comes back to the member
await signer.sendTransaction(await buildCancelTx({ subscription: subs[0], subscriber: signer }));
```

## API

| Function | Signed by | What it does |
|---|---|---|
| `buildSubscribeTx` | member | Creates the subscription cell and pays the first period to the creator |
| `buildClaimTx` | keeper (fee only) | Collects one due payment for the creator. The keeper must not be the creator |
| `buildTopUpTx` | member | Adds CKB; terms unchanged |
| `buildCancelTx` | member | Ends it; full refund minus the fee |
| `buildCloseTx` | keeper (fee only) | Ends a cell that can't fund another period; the refund goes to the member |
| `findSubscriptions` | — | Valid v3 subscriptions by member and/or creator lock hash (forged cells are ignored) |
| `viewSubscription` | — | Status, balance, payments left, blocks until the next payment |
| `explainScriptError` | — | Maps script exit codes to names, e.g. `11` → `PayoutMissing` |

All builders return **unsigned** `ccc.Transaction`s. The SDK never needs a private key. On a server, build with `new ccc.SignerCkbScriptReadonly(client, memberLock)` and let the member's wallet sign.

## Deployment (testnet, exported as `TESTNET`)

| Script | Code hash | cellDep |
|---|---|---|
| CadencePay v3 (`data1`) | `0x7c271b62bc4b726f5997f3dbd221cfdbf31c944da19871dc1d8fc3bb75910419` | `0x8acdf7ed…ada8b` #0 |
| Input Type Proxy Lock (`data1`) | `0x5123908965c711b0ffd8aec642f1ede329649bda1ebdca6bd24124d3796f768a` | `0xb4f171c9…7b93` #1 |

## Rules worth knowing

- `amount` must be at least about 61 CKB, the smallest standalone payout cell.
- Missed periods are collected one transaction at a time, never more than one `amount` per tx.
- Subscriptions are public on-chain: anyone can see which address supports which creator, and for how much.

MIT licensed.
