# Store Data on Cell — Result

Ran the official tutorial on devnet.

**Message stored:** "Linnette was here"  
**Tx Hash:** 0xb67913e98c37c40b60e491454a16ec7038efe5c2551f7b55c11347fc013c523f  

## What This Demonstrates

- Arbitrary data encoded as UTF-8 → hex stored in a cell's data field
- CCC SDK handling input selection, fee calculation, signing, and broadcast
- `getLiveCell` RPC call to retrieve the cell by OutPoint (txHash + index)
- The cell persists on-chain — the message lives there until the cell is consumed
