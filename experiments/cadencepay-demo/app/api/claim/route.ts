import { NextRequest, NextResponse } from "next/server";
import { ccc } from "@ckb-ccc/core";

const CODE_HASH  = process.env.NEXT_PUBLIC_CADENCEPAY_CODE_HASH!;
const DEPLOY_TX  = process.env.NEXT_PUBLIC_CADENCEPAY_TX_HASH!;
const PRIVATE_KEY = process.env.CKB_PRIVATE_KEY!;

export async function POST(req: NextRequest) {
  try {
    const { outPoint, cellDataHex } =
      await req.json() as {
        outPoint:    { txHash: string; index: string };
        cellDataHex: string;
      };

    const client  = new ccc.ClientPublicTestnet();
    const signer  = new ccc.SignerCkbPrivateKey(client, PRIVATE_KEY as `0x${string}`);
    const serverAddr = await signer.getRecommendedAddressObj();
    const serverLock  = serverAddr.script;

    // Fetch the live cell to get its EXACT type script (including args)
    // This is the subscriber lock hash we need — don't recompute it
    const liveCell = await client.getCellLive(
      {
        txHash: outPoint.txHash as `0x${string}`,
        index:  ccc.numFrom(outPoint.index),
      },
      true // withData
    );

    if (!liveCell) {
      return NextResponse.json(
        { success: false, error: "Cell not found or already consumed" },
        { status: 404 }
      );
    }

    if (!liveCell.cellOutput.type) {
      return NextResponse.json(
        { success: false, error: "Cell has no type script" },
        { status: 400 }
      );
    }

    // Use the EXACT type script from the live cell — args must match exactly
    const exactTypeScript = liveCell.cellOutput.type;

    // Get current tip block header for header_dep
    const tipRes = await fetch("https://testnet.ckb.dev", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: 1, jsonrpc: "2.0",
        method: "get_tip_header", params: []
      }),
    });
    const { result: tipHeader } = await tipRes.json() as {
      result: { number: string; hash: string };
    };

    const currentBlock   = BigInt(tipHeader.number);
    const tipHeaderHash  = tipHeader.hash as `0x${string}`;

    // Validate interval elapsed
    const inputData       = new Uint8Array(ccc.bytesFrom(cellDataHex as `0x${string}`));
    const view            = new DataView(inputData.buffer);
    const lastClaimedBlock = view.getBigUint64(48, true);
    const intervalBlocks   = view.getBigUint64(40, true);

    if (currentBlock < lastClaimedBlock + intervalBlocks) {
      const remaining = lastClaimedBlock + intervalBlocks - currentBlock;
      return NextResponse.json(
        { success: false, error: `Too early — ${remaining} blocks remaining` },
        { status: 400 }
      );
    }

    // Build output data — identical to input except last_claimed_block = currentBlock
    const outputData = new Uint8Array(inputData);
    new DataView(outputData.buffer).setBigUint64(48, currentBlock, true);

    const tx = ccc.Transaction.from({
      cellDeps: [{
        outPoint: {
          txHash: DEPLOY_TX as `0x${string}`,
          index:  "0x0",
        },
        depType: "code",
      }],
      headerDeps: [tipHeaderHash],
      inputs: [{
        previousOutput: {
          txHash: outPoint.txHash as `0x${string}`,
          index:  outPoint.index,
        },
        since: "0x0",
      }],
      // Output cell uses the EXACT same type script as the input
      outputs: [{
        capacity: liveCell.cellOutput.capacity,
        lock:     serverLock,
        type:     exactTypeScript,
      }],
      outputsData: [ccc.bytesFrom(outputData)],
    });

    await tx.completeFeeBy(signer, 1000n);
    const txHash = await signer.sendTransaction(tx);

    return NextResponse.json({
      success: true,
      txHash,
      newLastClaimedBlock: currentBlock.toString(),
      explorerUrl: `https://pudge.explorer.nervos.org/transaction/${txHash}`,
    });

  } catch (err) {
    console.error("Claim error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
