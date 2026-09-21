import { NextRequest, NextResponse } from "next/server";
import { ccc } from "@ckb-ccc/core";

const CODE_HASH   = process.env.NEXT_PUBLIC_CADENCEPAY_CODE_HASH!;
const PRIVATE_KEY = process.env.CKB_PRIVATE_KEY!;

function bytesToHex(b: Uint8Array) {
  return "0x" + Array.from(b).map(x => x.toString(16).padStart(2,"0")).join("");
}

export async function GET(req: NextRequest) {
  try {
    const client  = new ccc.ClientPublicTestnet();
    const signer  = new ccc.SignerCkbPrivateKey(client, PRIVATE_KEY as `0x${string}`);
    const serverAddr = await signer.getRecommendedAddressObj();
    const serverLock = serverAddr.script;

    // Get current block
    const tipRes = await fetch("https://testnet.ckb.dev", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: 1, jsonrpc: "2.0", method: "get_tip_block_number", params: [] }),
    });
    const tipData = await tipRes.json() as { result: string };
    const currentBlock = BigInt(tipData.result);

    const subscriptions: object[] = [];

    // Query by server lock (server owns all demo cells) + type script prefix
    // This finds ALL subscription cells regardless of subscriber
    for await (const cell of client.findCells({
      script:           serverLock,
      scriptType:       "lock",
      scriptSearchMode: "exact",
      filter: {
        script: new ccc.Script(
          CODE_HASH as `0x${string}`,
          "data1" as ccc.HashType,
          "0x" as `0x${string}`,
        ),
      },
    })) {
      const raw = new Uint8Array(ccc.bytesFrom(cell.outputData ?? "0x"));
      if (raw.length < 56) continue;

      const view              = new DataView(raw.buffer, raw.byteOffset);
      const amountPerInterval = view.getBigUint64(32, true);
      const intervalBlocks    = view.getBigUint64(40, true);
      const lastClaimedBlock  = view.getBigUint64(48, true);
      const recipientLockHash = bytesToHex(raw.slice(0, 32));

      const nextClaimBlock  = lastClaimedBlock + intervalBlocks;
      const canClaimNow     = currentBlock >= nextClaimBlock;
      const blocksRemaining = canClaimNow ? 0n : nextClaimBlock - currentBlock;

      subscriptions.push({
        outPoint: {
          txHash: cell.outPoint.txHash,
          index:  String(cell.outPoint.index),
        },
        cellDataHex:       bytesToHex(raw),
        recipientLockHash,
        amountPerInterval: amountPerInterval.toString(),
        intervalBlocks:    intervalBlocks.toString(),
        lastClaimedBlock:  lastClaimedBlock.toString(),
        currentBlock:      currentBlock.toString(),
        canClaimNow,
        blocksRemaining:   blocksRemaining.toString(),
      });
    }

    return NextResponse.json({ subscriptions, currentBlock: currentBlock.toString() });

  } catch (err) {
    console.error("Subscriptions error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
