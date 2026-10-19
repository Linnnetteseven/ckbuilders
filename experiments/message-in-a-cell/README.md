# Message in a Cell

*A message to the future, sealed in a cell.* Record a video, take a photo or write a letter, put CKB in with it, and seal it until a day that matters. When they open it, the message is theirs, and so is the CKB.

CKB testnet only. Not audited.

## Why it's naturally CKB
Storing data on CKB locks 1 CKB per byte, and opening a capsule releases **all** of it to the recipient. So the message storage isn't a fee; it's part of the gift. Opening the message and receiving the CKB happen in the same transaction.

## Who can open it
| Mode | Opens | Who | Notes |
|---|---|---|---|
| Gift, to their wallet | On the date | Only the recipient's wallet | Safest: not even the sender can open it |
| Gift, as a link + secret word | On the date | Whoever has the link **and** the four words | Keys come from PBKDF2-SHA256 (600k rounds) of the link seed plus the words. A leaked link alone opens nothing and reveals nothing |
| Gift, sender reclaim | 90 days after the date | The sender's wallet | Only if still unopened |
| Legacy ("if I'm gone") | After N days with no check-in | The beneficiary | The owner can withdraw or check in at any time; checking in restarts the clock |

The date is enforced by CKB consensus through each input's `since` field; the lock checks that the right kind of `since` is used. Our server never sees the link's key part, the words, or any plaintext. Videos and voice notes are encrypted in the browser before upload, and their sha256 is stored in the cell.

## Pieces
- `../time-lock-script/contracts/capsule-lock`: the lock (Rust). Args are `mode ‖ sender_lock_hash ‖ recipient_lock_hash ‖ t`. Testnet code hash `0x23d62274206d1204929fee3cb2514ab9945c2e1ab8d1fad6fef27ddc1af567be` (`data1`), cellDep `0x8b4bd8a0…8f4b` #0. Run its 23 attack tests with `cargo test -p tests capsule_lock`.
- `lib/capsule.ts`: lock args, `since` helpers, the Molecule cell format, AES-GCM encryption, share links, and tx builders (`buildSealTx`, `buildSpendTx`, `buildOpenWithGiftKeyTx`, `buildCheckInTx`, `loadCapsule`, `findMyCapsules`).
- `lib/secretWord.ts`: secret-word key derivation. `lib/media.ts`: photo shrinking and encrypted recordings.
- Pages: `/` (scroll story), `/seal`, `/c/<id>` (open), `/mine`, and `/deploy` (local only: deploy the lock with your own wallet).

## Run
```bash
npm install
npm run dev        # http://localhost:3000
npm test           # unit tests
# live testnet e2e (~15 min, funded testnet key, never printed):
PRIVATE_KEY=... npx tsx scripts/e2e-testnet.ts
```
Video and voice uploads need `BLOB_READ_WRITE_TOKEN` (a Vercel Blob store connected to the project).

## Honest limits
- In link mode, the sender chose the words, so the sender could also open it on the day. Seal to the recipient's wallet to rule that out.
- The message is encrypted, not time-locked: anyone with the full key (link + words) could decrypt it early from chain data. Only the CKB is truly locked until the date. Stretch goal: drand timelock encryption.
- A video or voice note lives in Vercel Blob. If that storage disappears, the letter and photo (on-chain) remain.
