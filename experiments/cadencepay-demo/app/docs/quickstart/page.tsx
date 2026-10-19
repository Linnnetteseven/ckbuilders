import type { Metadata } from "next";
import Link from "next/link";
import { Code } from "@/components/docs/Code";

export const metadata: Metadata = { title: "Quickstart" };

export default function Quickstart() {
  return (
    <>
      <h1>Quickstart</h1>
      <p className="lede">Create a membership, read it back, collect a payment and cancel, all on CKB testnet, in about ten minutes.</p>

      <h2>1. Install</h2>
      <p>The SDK has one peer dependency, <a href="https://github.com/ckb-devrel/ccc" target="_blank" rel="noreferrer">CCC</a>, which handles wallets and RPC.</p>
      <Code lang="bash">{`npm install cadencepay @ckb-ccc/core`}</Code>

      <h2>2. Get a signer and test CKB</h2>
      <p>
        In a browser app, use <code>@ckb-ccc/connector-react</code> and let the member connect JoyID or another wallet. For a script, a private-key signer is fine on testnet. Fund the address from the <a href="https://faucet.nervos.org" target="_blank" rel="noreferrer">testnet faucet</a>. Joining needs the payments you prefund, plus a refundable 226 CKB deposit for the cell itself.
      </p>
      <Code lang="ts">{`
import { ccc } from "@ckb-ccc/core";

const client = new ccc.ClientPublicTestnet();
// Browser: const { signer } = ccc.useCcc();
const signer = new ccc.SignerCkbPrivateKey(client, process.env.MEMBER_KEY!); // testnet only
`}</Code>

      <h2>3. Join</h2>
      <p>
        <code>buildSubscribeTx</code> pays the first period to the creator straight away and saves <code>prefundPeriods</code> more in the member&apos;s cell. Amounts are in shannons (1 CKB = 100,000,000 shannons), and each payment must be at least about 61 CKB.
      </p>
      <Code lang="ts">{`
import { buildSubscribeTx } from "cadencepay";

const creator = await ccc.Address.fromString("ckt1q...creator", client);
const tip = await client.getTipHeader();

const tx = await buildSubscribeTx({
  subscriber: signer,
  recipientLock: creator.script,
  amount: 100n * 100_000_000n, // 100 CKB per period
  intervalBlocks: 450n,        // about an hour
  prefundPeriods: 3n,          // three more payments saved
  tip: { hash: tip.hash, number: tip.number },
});
const joinTx = await signer.sendTransaction(tx);
console.log("joined", joinTx);
`}</Code>

      <h2>4. Read memberships from the chain</h2>
      <p>No database is needed. <code>findSubscriptions</code> returns only cells that pass the same checks the script makes, so forged cells are ignored.</p>
      <Code lang="ts">{`
import { findSubscriptions, viewSubscription } from "cadencepay";

const me = (await signer.getRecommendedAddressObj()).script;
const subs = await findSubscriptions(client, { subscriberLockHash: me.hash() });
const tipNow = await client.getTipHeader();
const view = viewSubscription(subs[0], tipNow.number);

console.log(view.status);            // "active" | "due" | "low_balance" | "closable"
console.log(view.periodsRemaining);  // payments left
console.log(view.blocksUntilNextClaim);
`}</Code>

      <h2>5. Collect a due payment</h2>
      <p>
        Anyone can collect. The <strong>keeper</strong> signs only to pay the network fee, and the script makes sure the amount goes to the creator. The keeper must not be the creator, because the fee would then come out of the creator&apos;s own payout.
      </p>
      <Code lang="ts">{`
import { buildClaimTx } from "cadencepay";

const keeper = new ccc.SignerCkbPrivateKey(client, process.env.KEEPER_KEY!);
if (view.status === "due") {
  const t = await client.getTipHeader();
  const claim = await buildClaimTx({
    subscription: subs[0],
    recipientLock: creator.script,
    tip: { hash: t.hash, number: t.number },
    keeper,
  });
  console.log("collected", await keeper.sendTransaction(claim));
}
`}</Code>
      <p>To do this automatically, run it on a schedule. The demo uses a Vercel cron job that also closes memberships that have run out (<code>buildCloseTx</code>).</p>

      <h2>6. Top up or cancel</h2>
      <Code lang="ts">{`
import { buildTopUpTx, buildCancelTx } from "cadencepay";

// Add two more payments; the terms can't change
await signer.sendTransaction(await buildTopUpTx({ subscription: subs[0], subscriber: signer, addCapacity: 200n * 100_000_000n }));

// Or end it: everything left comes back to the member
await signer.sendTransaction(await buildCancelTx({ subscription: subs[0], subscriber: signer }));
`}</Code>

      <h2>Explain failures</h2>
      <p>If a transaction is rejected, <code>explainScriptError</code> turns the script&apos;s exit code into a name such as <code>ClaimTooEarly</code>. The full list is in <Link href="/docs/rules">On-chain rules</Link>.</p>
      <Code lang="ts">{`
import { explainScriptError } from "cadencepay";

try { await keeper.sendTransaction(claim); }
catch (e) { console.error(explainScriptError(String(e)) ?? e); }
`}</Code>
    </>
  );
}
