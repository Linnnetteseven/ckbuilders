# Week 4 Report — CKBuilders
**Period:** Aug 17 – Aug 23, 2026

## What I worked on

In Week 2 I built the CKB Time Capsule dApp — lets people store
messages on-chain to be opened in the future. This week I built
the validation layer for it.

Built it twice in two different environments:

capsule-validator is a Rust CLI that runs locally. You pass it a
JSON string as a CLI argument, it checks the message exists and is
not empty, that there is a recipient and an open date, and exits 0
if valid or returns a specific error code if not. Tested with
cargo test — 5 tests passing.

capsule-type-script is the same logic as a real CKB Type Script in
TypeScript. Instead of reading from CLI args it reads from cell data
inside a transaction. When someone tries to store a capsule on-chain
this script runs automatically and accepts or rejects the transaction.
Verified with ckb-testtool — Run result: 0 ✅

## What I learned

Rust structs define the shape of the data and are strictly enforced
at compile time. My CapsuleData has four fields: message, recipient,
open_date, sealed_at. The struct enforces the shape but does not check
if fields are empty — that is the job of validate().

impl blocks attach behaviour to a struct. validate() uses &self which
means it borrows the capsule to read it without consuming it. I
connected this to CKB — &self is like using a cell as a cell dep,
you read it and it stays intact. self without & would consume it like
spending an input cell.

The Display trait is a shared interface that defines how to print a
type. I implemented it for both CapsuleData and ValidationError.
Same trait, two different types.

Serde deserialization is similar to destructuring in JS but goes
further — it parses the raw JSON and maps it to the struct in one
step with compile time guarantees.

## Bugs we fixed

Three bugs before the TypeScript script tests went green:

1. bindings.Source.GroupOutput does not exist — the correct import
is SOURCE_GROUP_OUTPUT as a named export directly from the package.

2. TextDecoder is not a global in the WASM test environment — imported
it directly from @ckb-js-std/bindings instead.

3. The mock test was sending random hex bytes as cell data not actual
JSON. The script correctly rejected it with exit code 3. The script
was right, the test was wrong. Fixed by encoding real capsule JSON
as bytes in the test transaction.

The devnet integration test was excluded — it requires a live local
CKB node which is the Week 5 starting point.

## Next week

Start the devnet node, deploy capsule-type-script with offckb, and
get the full test suite green including devnet.
Continue on Rust Book.
