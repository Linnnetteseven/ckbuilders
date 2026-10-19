# CKBuilders Weekly Report — Week 12

**Builder:** Linnette Mugwanja (@Linnette77)
**Period:** Oct 12 – Oct 19, 2026

---

## Summary

CadencePay is finished as a product: the SDK is on npm, the demo has a landing page and docs, and every on-chain mode now runs from the app. Then I used it for something real. Climate Black Box now keeps its evidence on an on-chain ledger and streams donations through CadencePay into a gate that holds the money while an alert is open. I also rebuilt my week 2 time capsule as **Message in a Cell**, with a new lock script. My friend sealed a message for me this week, and opening it was the moment it all felt real.

- CadencePay: https://cadencepay-demo.vercel.app · docs: https://cadencepay-demo.vercel.app/docs · npm: https://www.npmjs.com/package/cadencepay
- Climate Black Box: https://climateblackbox.duckdns.org
- Message in a Cell: https://message-in-a-cell.vercel.app

## What I built

**CadencePay (capstone)**
- **Published `cadencepay` 0.3.0 on npm:** ESM + CommonJS, MIT, 19 tests. It builds unsigned transactions only, so it never touches a private key.
- **Close & refund:** a membership that runs out can be closed by anyone, and the refund always goes to the member. The daily keeper now collects *and* closes.
- **Payment history:** read straight from the chain (join, payments, top-ups, end).
- **Creator sign-up:** creator profiles are on-chain cells under the creator's own lock, so payouts can't be redirected. A profile only counts if its owner signed it. Display photos use wallet-signed uploads.
- **Site:** a landing page, docs (quickstart, SDK reference, rules and error codes, deployments, security & privacy), and a "join from a fresh wallet" privacy option.

**Climate Black Box × CKB**
- **`evidence-ledger` (type script):**
  - One cell per project, which recomputes a running hash over every evidence event.
  - History can't be rewritten, reordered, skipped, forked or deleted, not even by me.
  - Anyone can re-check the whole history from the chain.
- **`evidence-gate` (lock script):** donations are CadencePay subscriptions paying into a gate that reads the ledger as a cell dep. The project collects while there's no open alert; during an alert the money is held and the donor can take it back.
- **31 attack tests**, including the real CadencePay binary paying into a gate. Deployed: ledger `0x3429e6ce…08e5`, gate `0x5b74aa07…fc3d`.
- **Live:** all 7 Mau Transmara evidence records are on the ledger and verify, the site has a new "Fund" chapter, and the pipeline appends instead of rebuilding history.

**Message in a Cell (time capsule v3)**
- **`capsule-lock` (Rust):**
  - **Gift mode:** opens on a date, and the sender can reclaim it if it's still unopened 90 days later.
  - **Legacy mode ("if I'm gone"):** the owner checks in; the beneficiary can claim after inactivity.
  - Dates are enforced by consensus through `since`.
- **23 attack tests**, deployed at `0x23d62274…67be`. This fixes my week 5 time-lock bug, where anyone could spend the CKB after the date.
- **App:**
  - a letter, a photo (stored in the cell, so the storage CKB is part of the gift), and video or voice notes (encrypted in the browser);
  - send to a wallet, or as a link protected by a 4-word secret word;
  - countdowns that use the chain's own clock.
- I retired the old time-capsule page that asked for a private key.

## Testnet runs

| What | Result |
|---|---|
| Climate Black Box funding e2e | Ledger, 3 observations, a donation via `cadencepay`, the project withdrew on clean evidence, an alert, **the gate refused the project's withdrawal**, the donor took the payment back, the alert was resolved, and the history re-folded from the chain |
| Message in a Cell e2e | **Opening early was refused by the network**, a link opened on time, the letter and photo decrypted from chain history, and a legacy check-in plus a beneficiary claim worked |
| Real use | I opened a capsule I sealed for myself; a friend sealed one for me |

Transactions: `notes/deployments.md`.

## What I learned

- `since` is the right clock for time locks. Consensus enforces it, unlike a header the spender picks. It also follows the median of recent block times, a couple of minutes behind real time, and my countdown had to learn that.
- A cell dep is a way to read another contract's *live* state. That's what lets the gate trust the ledger.
- Reusing my own SDK in a second product found the rough edges faster than any test did.
- "Anyone with the link" isn't good enough security. A second factor or binding to the recipient's wallet is needed.

## Challenges

- My Climate Black Box pipeline used to delete and rebuild its audit chain on every run, the very thing the ledger now forbids. Switching to append-only meant changing the pipeline, not just adding a contract.
- My friend's "10-minute" capsule opened in 24 hours because of a silent default in the form. I redesigned how the opening time is chosen.
- Live-database migrations needed care: the usual reset command drops every table.

## Links

- Repo: https://github.com/Linnnetteseven/ckbuilders
- Climate Black Box: https://github.com/Linnnetteseven/climate-black-box
- Testnet records: `notes/deployments.md`
