# cadencepay — Subscription Cell type script (v3)

A cell-native recurring payment primitive for CKB. The subscriber funds one Subscription Cell. The creator, or any keeper, can take **at most `amount` every `interval` blocks**, paid to the creator's lock. The subscriber can cancel at any time and gets the rest back.

Threat model: [`notes/cadencepay-threat-model.md`](../../../../notes/cadencepay-threat-model.md)

## Cell layout

| Part | Bytes | Content |
|---|---|---|
| lock | — | **Input Type Proxy Lock** (`data1`, code hash `0x5123908965c711b0ffd8aec642f1ede329649bda1ebdca6bd24124d3796f768a`), args = hash of this cell's type script. The lock passes whenever the cell is spent, so this type script is the only authority |
| type args `[0..32]` | 32 | Type ID: `blake2b(first input ‖ output index u64 LE)` |
| type args `[32..64]` | 32 | `subscriber_lock_hash` |
| data `[0..32]` | 32 | `recipient_lock_hash` |
| data `[32..40]` | 8 | `amount_per_interval`, shannons, u64 LE |
| data `[40..48]` | 8 | `interval_blocks`, u64 LE, ≥ 100 |
| data `[48..56]` | 8 | `next_claim_block`, u64 LE |

Occupied capacity is about **226 CKB**. Creation also needs at least one `amount` on top.

## Modes (by script-group shape)

| Shape | Mode | Who | Rules |
|---|---|---|---|
| 0 → 1 | create | subscriber | valid Type ID; `amount > 0`; `interval ≥ 100`; recipient ≠ 0; `next_claim ≥ header_dep[0].number`; lock = proxy lock over own type hash; capacity ≥ occupied + amount; an input with the subscriber lock |
| 1 → 1 | claim | anyone | `header_dep[0].number ≥ next_claim`; `next_claim' = next_claim + interval`; recipient/amount/interval/lock unchanged; `capacity' = capacity − amount`; net CKB to the recipient lock ≥ amount; only one CadencePay input in the tx |
| 1 → 1 | top-up | subscriber | capacity grows, data identical, subscriber input present |
| 1 → 0 | cancel | subscriber | net CKB to the subscriber lock ≥ cell capacity − 0.01 CKB |
| 1 → 0 | close | anyone | only when `capacity − occupied < amount`; net CKB to the subscriber ≥ cell capacity |

Missed periods can be caught up one claim tx at a time. The claimer pays the tx fee from their own input, and that claimer must **not** be the recipient: payouts are counted net per lock, so a fee paid from the recipient's own cells would push their net payout below `amount`. In practice `amount` must be at least the smallest standalone payout cell (61 CKB for a secp256k1 lock). `@cadencepay/sdk` enforces this when building a subscribe tx.

## Error codes

1 InvalidArgs · 2 InvalidDataSize · 3 InvalidGroupShape · 4 TypeIdInvalid · 5 NoHeader · 6 ClaimTooEarly · 7 ScheduleNotAdvanced · 8 FieldsChanged · 9 LockChanged · 10 CapacityMismatch · 11 PayoutMissing · 12 MultipleSubscriptions · 13 SubscriberAuthMissing · 14 RefundMissing · 15 InvalidTerms · 16 WrongLock · 17 InsufficientCapacity · 18 Overflow · 19 BalanceSufficient · 20 InvalidStart · 30 Syscall

## Build (reproducible)

```bash
source ~/.cargo/env
cd experiments/time-lock-script
make build CLANG=clang-16 CUSTOM_RUSTFLAGS=""   # production: no debug-assertions
cargo test -p tests                             # 49 tests (46 cadencepay v3)
```

Built with rustc 1.96.1 + clang-16, `[profile.release.package.cadencepay] opt-level = "z"`. That gives **42,368 bytes** and code hash **`0x7c271b62bc4b726f5997f3dbd221cfdbf31c944da19871dc1d8fc3bb75910419`**, confirmed identical from a clean copy. Plain `make build` keeps the template's `-C debug-assertions` and produces a different, larger binary; never deploy that one.

## Trust assumptions

- Deployed as `data1` without Type ID, so the code **can't be upgraded by anyone**. Fixes ship as a new code hash.
- Input Type Proxy Lock is also `data1` (immutable), from ckb-devrel/ckb-proxy-locks.
- Unaudited. Testnet only.
