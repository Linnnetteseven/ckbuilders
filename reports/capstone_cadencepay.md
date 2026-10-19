# CKBuilders Capstone: CadencePay

**Builder:** Linnette Mugwanja (@Linnette77)
**Recurring payments on CKB where the person paying stays in control.**

- Live: https://cadencepay-demo.vercel.app (demo: `/app`, docs: `/docs`)
- SDK: https://www.npmjs.com/package/cadencepay (`npm install cadencepay @ckb-ccc/core`)
- Code: https://github.com/Linnnetteseven/ckbuilders (`experiments/time-lock-script`, `cadencepay-sdk`, `cadencepay-demo`)

---

## Why I built it

Every subscription I've had could take more than I agreed to, or keep charging after I left. Creators here in Kenya deserve steady income without a platform taking a cut or sitting on their money. I wanted paying someone over time to feel like handing over cash, not handing over your wallet. On CKB, the rules can protect the person paying instead of a company promising to.

## What it is

A member funds their **own** subscription cell. One type script enforces:

- the creator (or anyone) can collect **exactly the agreed amount, at most once per period**, always paid to the creator;
- the price, period and recipient can never change;
- the member can top up or cancel at any time and get everything that hasn't been paid back;
- when a membership runs out, anyone can close it, and the refund always goes to the member.

No server holds keys or money. Collecting needs no signature at all: a keeper just pays the network fee.

## How it works

```
Member wallet (JoyID) ──join / top up / cancel──▶ Subscription cell ──exactly `amount`, once per period──▶ Creator
                                                   type: CadencePay v3        ▲
                                                   lock: Input Type Proxy Lock │ keeper (pays the fee only)
```

| Piece | What it does |
|---|---|
| **CadencePay v3 type script** (Rust) | Modes by group shape: join 0→1, collect and top-up 1→1, cancel and close 1→0. Type ID, an anchored schedule, net-payout accounting, one subscription per transaction. Code hash `0x7c271b62…0419` |
| **Input Type Proxy Lock** | The cell's lock defers to its own type script, so no private key controls a subscription |
| **`cadencepay` SDK** (npm) | Unsigned builders for every mode, chain reads that ignore forged cells, error explanations. ESM + CJS, no keys |
| **Demo app** | A Patreon-style membership app: creators, tiers, members-only posts (wallet-signed, checked on-chain), checkout, memberships with payment history, a creator dashboard, creator sign-up (on-chain profiles), and a daily keeper |

## Security

- I audited my own v2 and found real bugs: claims never paid the creator, cells could be drained or merged, and the server controlled every subscription. I rewrote it as v3 **with the attack tests first**: 46 attack tests, all passing (`notes/w10-w11-audit.md`, `notes/cadencepay-threat-model.md`).
- The SDK and app never handle member keys. Members sign in their own wallet.
- **Honest limits:**
  - testnet only and not externally audited;
  - memberships are public on-chain (the docs explain the fresh-wallet option);
  - a member can cancel just before a payment is collected, so the first period is paid upfront.

## Proof on testnet

| Step | Tx |
|---|---|
| Join (JoyID-signed) | `0x7b639369…dd12` |
| Collect ×2 (keyless keeper) | `0x4b0dac73…db02`, `0x15297227…3ce0` |
| Top up | `0x679ca6b8…9027` |
| Cancel, full refund | `0x96925887…f234` |

Full table: `notes/deployments.md`.

## Built on it: Climate Black Box

CadencePay isn't just a demo. **Climate Black Box** (my climate-monitoring project, https://climateblackbox.duckdns.org) uses the `cadencepay` npm package for **evidence-gated funding**:

- **`evidence-ledger` type script:** each project's satellite evidence goes into one append-only on-chain history that can't be rewritten, reordered or deleted.
- **`evidence-gate` lock script:** a donor's CadencePay subscription pays into a gate that reads that ledger as a cell dep. The project collects while the evidence is clean. When an alert is open, payments are **held**, and the donor can take them back.
- **31 attack tests**, including the real CadencePay binary paying into a gate.
- **A live testnet run** where the network itself refused the project's withdrawal during an alert.

The site's "Fund" chapter lets anyone donate with JoyID.

## Built with the same toolkit: Message in a Cell

**Message in a Cell** (https://message-in-a-cell.vercel.app) seals a letter, a photo or a video with CKB until a day that matters. It doesn't use CadencePay. It's built with the same approach: owner-input authorisation, consensus-enforced time (`since`), attack tests first (23), signed uploads, and JoyID.

- **The storage is part of the gift:** every byte of the message locks CKB, and the recipient receives all of it when they open it.
- **A real open:** I opened a capsule I'd sealed, and a friend sealed one for me.

## Try it in two minutes

1. Open https://cadencepay-demo.vercel.app/app and connect JoyID (no app needed).
2. Get free test CKB from https://faucet.nervos.org.
3. Join Otieno Builds → **Quick test** (70 CKB, about 15 minutes).
4. Watch it on **Memberships**. On **For creators**, collect when it's due, then close it, and the rest comes back to you.

Or for developers: https://cadencepay-demo.vercel.app/docs/quickstart

## What's next

- An external review of the three scripts before any mainnet use.
- KeyWay email and Google wallets, so members and creators never need to think about crypto.
- A Nervos Talk post on evidence-gated funding as a pattern for grants and climate finance.
