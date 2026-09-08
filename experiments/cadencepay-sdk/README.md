# @cadencepay/sdk

TypeScript SDK for the CadencePay recurring payment protocol on CKB.

## What is CadencePay

Cell-native subscription payments. A Subscription Cell encodes who
gets paid, how much, and how often. Anyone can trigger a claim when
the interval has elapsed. The subscriber can cancel at any time.
No custodian. No trusted third party. The CKB type script enforces
everything.

## API

```typescript
import {
  encodeSubscriptionData,
  decodeSubscriptionData,
  canClaim,
  encodeClaimOutputData,
} from "@cadencepay/sdk";

// Create subscription cell data
const data = encodeSubscriptionData({
  recipientLockHash:  "0x...",
  amountPerInterval:  500_000_000n,  // 5 CKB
  intervalBlocks:     2000n,          // ~1 day on CKB
  subscriberLockHash: "0x...",
});

// Before claiming, check if interval elapsed
const ok = canClaim(lastClaimedBlock, intervalBlocks, currentBlock);

// Build output cell data for a valid claim
const outputData = encodeClaimOutputData(inputData, currentBlock);
```

## Status

v0.1.0 — encoding/decoding utilities complete.  
Transaction builders coming in v0.2.0 (W8).
