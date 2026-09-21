import { ccc } from "@ckb-ccc/core";

const CODE_HASH =
  process.env.NEXT_PUBLIC_CADENCEPAY_CODE_HASH ??
  "0x0000000000000000000000000000000000000000000000000000000000000000";

const DEPLOY_TX =
  process.env.NEXT_PUBLIC_CADENCEPAY_TX_HASH ?? "0x";

/**
 * The deployed cadencepay type script reference.
 * Use this as cellDep when building subscription transactions.
 */
export const CADENCEPAY_SCRIPT = {
  codeHash: CODE_HASH,
  hashType:  "data1" as ccc.HashType,
};

export const CADENCEPAY_CELL_DEP = {
  outPoint: { txHash: DEPLOY_TX, index: "0x0" },
  depType:  "code" as const,
};

export const TESTNET_CLIENT = new ccc.ClientPublicTestnet();

export const EXPLORER_TX = (hash: string) =>
  `https://pudge.explorer.nervos.org/transaction/${hash}`;
