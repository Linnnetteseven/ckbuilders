/**
 * experiments/testnet-transfer/transfer.ts
 *
 * Sends 100 CKB from account #0 to account #1 on the CKB testnet.
 *
 * Uses the CCC SDK (https://docs.nervos.org/docs/sdk-and-devtool/ccc)
 * which handles input selection, fee calculation, signing, and broadcast.
 *
 * Private key is read from the environment — never hardcode secrets,
 * even on testnet. Treat key hygiene as a habit from day one.
 *
 * Run:
 *   CKB_PRIVATE_KEY=0x... pnpm ts-node transfer.ts
 */

import { ccc } from "@ckb-ccc/ccc";

// Recipient: account #1 from offckb accounts
const TO_ADDRESS =
  "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqt435c3epyrupszm7khk6weq5lrlyt52lg48ucew";

// 100 CKB expressed in Shannons (1 CKB = 10^8 Shannons)
// Using BigInt because uint64 exceeds JavaScript's safe integer range
const AMOUNT_SHANNONS = 100n * 10n ** 8n;

async function main(): Promise<void> {
  const privateKey = process.env.CKB_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error(
      "CKB_PRIVATE_KEY environment variable is required.\n" +
      "Run: CKB_PRIVATE_KEY=0x... pnpm ts-node transfer.ts"
    );
  }

  // Connect to the public CKB testnet
  const client = new ccc.ClientPublicTestnet();

  // Build a signer from the raw private key.
  // In production you would use a hardware wallet or key management system.
  const signer = new ccc.SignerCkbPrivateKey(client, privateKey);

  const fromAddress = await signer.getRecommendedAddress();
  console.log("Sender:    ", fromAddress);
  console.log("Recipient: ", TO_ADDRESS);
  console.log("Amount:    ", AMOUNT_SHANNONS.toString(), "Shannons (100 CKB)");

  // Resolve recipient address string to its underlying lock script.
  // CKB does not natively understand address strings — the address is
  // an encoding of the lock script. We unpack it here.
  const toAddr = await ccc.Address.fromString(TO_ADDRESS, client);

  // Construct the transaction with a single output.
  // capacity: how much CKB this cell holds (must cover its own byte size)
  // lock:     the script that controls who can spend this cell
  const tx = ccc.Transaction.from({
    outputs: [
      {
        capacity: AMOUNT_SHANNONS,
        lock: toAddr.script,
      },
    ],
    outputsData: ["0x"], // no additional data on this cell
  });

  // Automatically select live cells from the sender's address to cover
  // the output capacity. Adds a change output back to sender if needed.
  await tx.completeInputsByCapacity(signer);

  // Calculate and deduct the transaction fee at 1000 Shannons/KB.
  // Fee = fee_rate * tx_size_in_bytes / 1000
  await tx.completeFeeBy(signer, 1000n);

  // Sign all inputs and broadcast to the testnet node.
  const txHash = await signer.sendTransaction(tx);

  console.log("\n✓ Transaction submitted");
  console.log("  Hash:    ", txHash);
  console.log(
    "  Explorer:",
    `https://testnet.explorer.nervos.org/transaction/${txHash}`
  );
}

main().catch((err: Error) => {
  console.error("\n✗ Transfer failed:", err.message);
  process.exit(1);
});
