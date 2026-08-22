# capsule-validator

A Rust CLI that validates CKB Time Capsule cell data.

This is the validation logic that a CKB Type Script would run on-chain
to verify capsule outputs. Valid data exits 0. Invalid data exits with
a specific error code — identical to how CKB scripts signal pass/fail.

## Try it

```bash
cargo run -- '{"message":"Hello future me!","recipient":"yourname","open_date":"2027-01-01","sealed_at":"2026-08-12"}'
```

Create a capsule on the live dApp first:
https://ckb-time-capsule.vercel.app

Then grab the cell data from the CKB explorer and run it through here.

## Run the tests

```bash
cargo test
```

## Error codes

| Code | Reason |
|------|--------|
| 0 | Valid |
| 1 | Empty message |
| 2 | Empty recipient |
| 3 | Message over 500 chars |
| 4 | Missing open date |
| 5 | Invalid JSON |
