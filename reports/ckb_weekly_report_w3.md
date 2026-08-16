# Week 3 Report — CKBuilders
**Period:** Aug 10 – Aug 16, 2026

## What I worked on

Started `capsule-validator`, a Rust CLI that validates Time Capsule
cell data from Week 2. This mirrors what a CKB Type Script does
on-chain: valid data exits 0, invalid exits with an error code.

## What I learned

Rust structs and impl blocks, borrowing with &self, custom error
enums using ValidationError, and serde deserialization which is
similar to JS destructuring but parses and maps in one step with
compile time guarantees.

## Next week

Finish capsule-validator, wire up JSON parsing, Display trait, CLI
args and exit codes. 

## Honest note

Slow week overall. Plan is to make up for it in Week 4.
