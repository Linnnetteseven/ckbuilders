# CadencePay deployments (CKB testnet)

| Version | Code hash (`data1`) | Deploy tx (cellDep index 0) | Size | Date | Notes |
|---|---|---|---|---|---|
| v2 | `0x05d60806d86b478715633f846d2e4d31e60b95b4ea0af4f5ce6c72e19d4b6fb4` | `0x5ee7b1eacd6065bf2f040d678ae2e21987390317dfaadeec1b69be3e8574a3d9` | 40,792 B | 2026-09-21 | Superseded. Insecure claim/owner modes (threat model #2–#8). 6 legacy server-locked cells remain (#16) |
| v3 | `0x7c271b62bc4b726f5997f3dbd221cfdbf31c944da19871dc1d8fc3bb75910419` | `0x8acdf7ed16e21ed29c3fc0c9f2067e8901e7ee8dce5a1b4c686e5c24c9eada8b` | 42,368 B | 2026-10-07 (block 22,667,031) | Proxy lock + Type ID + group counts + payout/capacity rules + cancel/top-up/close |

## Dependencies (not ours)
| Script | Code hash | cellDep |
|---|---|---|
| Input Type Proxy Lock (`data1`) | `0x5123908965c711b0ffd8aec642f1ede329649bda1ebdca6bd24124d3796f768a` | `0xb4f171c9c9caf7401f54a8e56225ae21d95032150a87a4678eac3f66a3137b93` index 1 |

v3 verified on-chain 2026-10-07: tx committed; output 0 is 42,368 bytes whose blake2b hash = the code hash above; no type script (`data1`, immutable). Code cell locked by deployer `ckt1qzda…svgrrcn` (secp args `0x5cb80988…`). **Never spend that cell**, or the cellDep breaks.
Explorer: https://pudge.explorer.nervos.org/transaction/0x8acdf7ed16e21ed29c3fc0c9f2067e8901e7ee8dce5a1b4c686e5c24c9eada8b

## Live testnet e2e (v3, JoyID wallet)
| Step | Tx | Block | Result |
|---|---|---|---|
| Subscribe (JoyID-signed) | `0x7b639369604f517879bb59ed0d70f87f890decb0f0fcf543ed2ca8bbdc18dd12` | 22,672,300 | ✅ committed. out0 = Subscription Cell 526 CKB (226 occupied + 3×100) under Input Type Proxy Lock with cadencepay v3 type; out1 = 100 CKB first payment to the demo creator (secp `0x758d311c…`); out2 = JoyID change. First on-chain run of create mode. `next_claim_block` = 22,672,738 |
| Claim #1 (keeper, no user signature) | `0x4b0dac733c9ec7346b51b4e749323d8e607c61601b036a8b6253d5f7f072db02` | 22,695,531 | ✅ cell 526 → 426, +100 CKB to creator, `next_claim` 22,672,738 → 22,673,188 (+1 interval) |
| Claim #2 (catch-up) | `0x15297227514cbabaaa85bf652be1642878a31a516ad119c1aedf20435d2d3ce0` | 22,695,538 | ✅ 426 → 326, +100 CKB, `next_claim` → 22,673,638. One period per tx, even though many were overdue |
| Top-up (JoyID) | `0x679ca6b87ab4934b9a7e1908c358682fdd7fea96a2cad40290b5d3495aed9027` | 22,695,556 | ✅ 326 → 526, data unchanged, nothing to creator |
| Cancel (JoyID) | `0x9692588768c99f29336459af77cf12e1d3d1fac16102117b52775d67bfe9f234` | 22,695,560 | ✅ cell consumed, full 526 CKB refunded to the subscriber's JoyID lock |

**Result (2026-10-10):** every v3 mode except `close` has now run on testnet with a real JoyID wallet and a keyless keeper. `close` is covered by the script tests only.
