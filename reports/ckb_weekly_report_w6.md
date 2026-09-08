## CKB Weekly Report — Week 6

**Builder:** Linet Mugwanja  **Period:** Sep 1 – Sep 7, 2026  **Repo:** github.com/Linnnetteseven/ckbuilders

## What I Built

Scaffolded the CadencePay type script — the on-chain core of mycapstone. CadencePay is a cell-native recurring payment protocol onCKB. Problem: there is no trustless way to do on-chain subscriptionswithout a custodian. The type script enforces subscription intervalsvia header_deps, subscriber keeps custody of funds the whole time.

# Key Concept: Lock vs Type Script

A lock script gates access — who can spend a cell, runs only oninputs. A type script validates state transitions — runs on bothinputs and outputs, so we can enforce what the resulting state mustlook like.For CadencePay: you can only spend the Subscription Cell if yourecreate it correctly with an updated `last_claimed_block`. The typescript checks: has enough time passed? Is the new cell identicalexcept for `last_claimed_block`? Did it update to the current block?All pass → exit 0. Any fail → named error code.

## The Subscription Cell — 56 bytes
[0..32]  recipient_lock_hash   — who receives payment

[32..40] amount_per_interval   — shannons per claim (u64 LE)

[40..48] interval_blocks       — blocks between claims (u64 LE)

[48..56] last_claimed_block    — block number of last claim (u64 LE)


We use block **number** not timestamp. Timestamps have ±30 seconds
of wiggle room by design. Block numbers are strictly sequential —
no wiggle room at all. Same header_deps mechanism from RFC 0022,
cleaner enforcement.

`Source::GroupInput` / `Source::GroupOutput` isolate only cells with
this specific type script hash, so the script doesn't accidentally
read unrelated cells in a complex transaction.

---

## Test Results
test test_unlocks_after_timestamp         ... ok  (cycles: 20,388)

test test_rejects_before_timestamp        ... ok

test test_rejects_missing_header_dep      ... ok

test test_cadencepay_valid_claim          ... ok  (cycles: 20,716)

test test_cadencepay_interval_not_reached ... ok
test result: ok. 5 passed; 0 failed



CadencePay rejection correctly shows `Inputs[0].Type` — the type
script, not the lock script. Error code 2 for early claim. 20,716
cycles — negligible.

---

## Capstone: CadencePay

Three layers: Rust type script (this week) → TypeScript SDK → demo
dApp with CKB Keyway for subscriber onboarding and Fiber Network for
payment settlement. My fiberprobe npm package from the last hackathon
handles Fiber route verification before each claim. This positions
CadencePay for the Fiber Part 2 hackathon, CKBuilders capstone, and
a Community Fund DAO grant.

---

## Next (W7)

- Cancel path + owner signature verification in type script
- Full test suite
- TypeScript SDK scaffold
