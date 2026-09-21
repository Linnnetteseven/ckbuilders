/**
 * CadencePay testnet deployment script
 * Usage: PRIVATE_KEY=0x... tsx deploy-testnet.ts
 */

import { ccc } from "@ckb-ccc/core";
import { readFileSync } from "fs";
import { resolve } from "path";

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error("Usage: PRIVATE_KEY=0x... tsx deploy-testnet.ts");
    process.exit(1);
  }

  const client = new ccc.ClientPublicTestnet();
  const signer  = new ccc.SignerCkbPrivateKey(client, privateKey);
  const address = await signer.getRecommendedAddress();

  console.log("Deployer address:", address);
  console.log("Checking balance...");

  // Binary path — compiled RISC-V output
  const binaryPath = resolve(
    __dirname,
    "../../time-lock-script/build/release/cadencepay"
  );
  const binary = readFileSync(binaryPath);
  console.log("Binary size:", binary.length, "bytes");

  // Data hash = blake2b of the binary content
  // Used as code_hash in the type script, with hash_type "data1"
  const codeHash = ccc.hashCkb(binary);
  console.log("Code hash:", codeHash);

  // Minimum capacity: binary length + 61 bytes overhead, in shannons
  const minCapacityShannons = BigInt(binary.length + 61) * 100_000_000n;
  console.log(
    "Minimum capacity needed:",
    Number(minCapacityShannons) / 1e8,
    "CKB"
  );

  // Build the deployment transaction
  // One output cell whose data IS the RISC-V binary
  const tx = ccc.Transaction.from({
    outputs: [
      {
        capacity: minCapacityShannons,
        lock: (await signer.getRecommendedAddressObj()).script,
      },
    ],
    outputsData: [ccc.bytesFrom(binary)],
  });

  await tx.completeInputsByCapacity(signer);
  await tx.completeFeeBy(signer, 1000n);
  await signer.signTransaction(tx);

  console.log("\nSending transaction...");
  const txHash = await client.sendTransaction(tx);

  console.log("\n✓ Deployed successfully!");
  console.log("──────────────────────────────────────────");
  console.log("TX Hash:   ", txHash);
  console.log("OutPoint:  { txHash:", txHash, ", index: 0x0 }");
  console.log("Code Hash: ", codeHash);
  console.log("Hash Type:  data1");
  console.log("──────────────────────────────────────────");
  console.log("\nAdd to your SDK config:");
  console.log(`  typeScriptCodeHash: "${codeHash}",`);
  console.log(`  typeScriptHashType: "data1" as ccc.HashType,`);
  console.log("\nView on explorer:");
  console.log(`  https://pudge.explorer.nervos.org/transaction/${txHash}`);
}

main().catch((err) => {
  console.error("Deploy failed:", err);
  process.exit(1);
});
