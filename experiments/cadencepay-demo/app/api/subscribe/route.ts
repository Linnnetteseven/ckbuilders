import { NextRequest, NextResponse } from "next/server";
import { ccc } from "@ckb-ccc/core";

const CODE_HASH  = process.env.NEXT_PUBLIC_CADENCEPAY_CODE_HASH!;
const DEPLOY_TX  = process.env.NEXT_PUBLIC_CADENCEPAY_TX_HASH!;
const PRIVATE_KEY = process.env.CKB_PRIVATE_KEY!;

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes  = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++)
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

function encodeSubscriptionData(
  recipientLockHash: string,
  amountPerInterval: bigint,
  intervalBlocks: bigint,
  subscriberLockHash: string,
): Uint8Array {
  const data = new Uint8Array(56);
  const view = new DataView(data.buffer);
  data.set(hexToBytes(recipientLockHash).slice(0, 32), 0);
  view.setBigUint64(32, amountPerInterval, true);
  view.setBigUint64(40, intervalBlocks, true);
  view.setBigUint64(48, 0n, true);
  // Note: subscriberLockHash goes in type script ARGS, not cell data
  void subscriberLockHash;
  return data;
}

export async function POST(req: NextRequest) {
  try {
    const { subscriberAddress, creatorAddress, amountShannons, intervalBlocks } =
      await req.json() as {
        subscriberAddress: string;
        creatorAddress:    string;
        amountShannons:    string;
        intervalBlocks:    string;
      };

    const client = new ccc.ClientPublicTestnet();
    const signer  = new ccc.SignerCkbPrivateKey(client, PRIVATE_KEY as `0x${string}`);

    // Server's lock — server owns the cell so it can trigger claims
    const serverAddr = await signer.getRecommendedAddressObj();
    const serverLock  = serverAddr.script;

    // Compute subscriber and recipient lock hashes for cell data / type args
    const subscriberAddrObj   = await ccc.Address.fromString(subscriberAddress, client);
    const subscriberLockHash  = subscriberAddrObj.script.hash();

    const creatorAddrObj    = await ccc.Address.fromString(creatorAddress, client);
    const recipientLockHash = creatorAddrObj.script.hash();

    const cellData = encodeSubscriptionData(
      recipientLockHash,
      BigInt(amountShannons),
      BigInt(intervalBlocks),
      subscriberLockHash,
    );

    // Type script: args = subscriber lock hash (owner/cancel mode)
    const typeScript = new ccc.Script(
      CODE_HASH as `0x${string}`,
      "data1" as ccc.HashType,
      subscriberLockHash as `0x${string}`,
    );

    const tx = ccc.Transaction.from({
      cellDeps: [{
        outPoint: { txHash: DEPLOY_TX as `0x${string}`, index: "0x0" },
        depType:  "code",
      }],
      outputs:     [{ capacity: 20_000_000_000n, lock: serverLock, type: typeScript }],
      outputsData: [ccc.bytesFrom(cellData)],
    });

    await tx.completeInputsByCapacity(signer);
    await tx.completeFeeBy(signer, 1000n);
    const txHash = await signer.sendTransaction(tx);

    return NextResponse.json({
      success: true,
      txHash,
      explorerUrl: `https://pudge.explorer.nervos.org/transaction/${txHash}`,
    });

  } catch (err) {
    console.error("Subscribe error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
