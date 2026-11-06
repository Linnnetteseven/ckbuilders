import type { Metadata } from "next";
import { Landing } from "@/components/landing/Landing";
import { highlight, highlightInline } from "@/lib/highlight";

export const metadata: Metadata = {
  title: { absolute: "CadencePay: support your favourite creators, stay in control" },
  description:
    "Recurring payments on CKB where members keep control. Creators collect the agreed amount once each period; members can top up or cancel any time. Try the demo or read the docs.",
};

const INSTALL_COMMAND = "npm install cadencepay @ckb-ccc/core";

const SNIPPET = `import { buildSubscribeTx } from "cadencepay";

const tx = await buildSubscribeTx({
  subscriber: signer,          // the member's wallet
  recipientLock: creator.script,
  amount: 100n * 100_000_000n, // 100 CKB
  intervalBlocks: 40_320n,     // about a week
  prefundPeriods: 3n,
  tip,
});
await signer.sendTransaction(tx);`;

export default async function Home() {
  const [snippet, command] = await Promise.all([highlight(SNIPPET, "ts"), highlightInline(INSTALL_COMMAND, "bash")]);
  return <Landing snippet={snippet} command={command} cmd={INSTALL_COMMAND} />;
}
