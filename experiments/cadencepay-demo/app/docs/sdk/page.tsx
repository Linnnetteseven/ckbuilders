import type { Metadata } from "next";
import { Code } from "@/components/docs/Code";

export const metadata: Metadata = { title: "SDK reference" };

const BUILDERS: [string, string, string, string][] = [
  ["buildSubscribeTx", "member", "subscriber, recipientLock, amount, intervalBlocks, prefundPeriods, tip, payFirstPeriod?", "Creates the subscription cell (Type ID) and, by default, pays the first period to the creator in the same transaction."],
  ["buildClaimTx", "keeper (fee only)", "subscription, recipientLock, tip, keeper", "Collects one due payment for the creator and moves the schedule forward by one period."],
  ["buildTopUpTx", "member", "subscription, subscriber, addCapacity", "Adds CKB. The terms and schedule stay the same."],
  ["buildCancelTx", "member", "subscription, subscriber", "Ends the membership; everything left goes back to the member."],
  ["buildCloseTx", "keeper (fee only)", "subscription, subscriberLock, keeper", "Ends a membership that can't fund another period. The refund always goes to the member."],
];

export default function Sdk() {
  return (
    <>
      <h1>SDK reference</h1>
      <p className="lede"><code>cadencepay</code> builds every CadencePay transaction <strong>unsigned</strong> and reads subscriptions from the chain. It never needs a private key.</p>
      <Code lang="bash">{`npm install cadencepay @ckb-ccc/core`}</Code>
      <p>It ships ESM and CommonJS builds with types, needs Node 18 or newer, and works in the browser.</p>

      <h2>Transaction builders</h2>
      <p>
        Every builder returns a <code>ccc.Transaction</code>. By default it also adds fee inputs and change from the signer named in the params. Pass <code>complete: false</code> to get just the CadencePay part and finish it yourself. Every builder also accepts <code>feeRate</code> and <code>deployment</code> (default <code>TESTNET</code>).
      </p>
      <table>
        <thead><tr><th>Function</th><th>Signed by</th><th>Params</th><th>What it does</th></tr></thead>
        <tbody>
          {BUILDERS.map(([fn, who, params, what]) => (
            <tr key={fn}><td><code>{fn}</code></td><td>{who}</td><td><code>{params}</code></td><td>{what}</td></tr>
          ))}
        </tbody>
      </table>
      <p>
        <code>tip</code> is <code>{"{ hash, number }"}</code> from <code>client.getTipHeader()</code>. The script reads that header to check the time, so use a recent one. To build on a server for a wallet that signs in the browser, use <code>new ccc.SignerCkbScriptReadonly(client, memberLock)</code> as the signer.
      </p>

      <h2>Reading the chain</h2>
      <h3><code>findSubscriptions(client, filter?, deployment?)</code></h3>
      <p>
        Returns every live, valid v3 subscription, optionally filtered by <code>subscriberLockHash</code> and/or <code>recipientLockHash</code>. Cells with the right type but the wrong lock, bad data or invalid terms are skipped, so a forged cell can&apos;t show up as a membership.
      </p>
      <h3><code>viewSubscription(sub, tipNumber, lowBalancePeriods = 2n)</code></h3>
      <p>Adds the derived fields an app needs:</p>
      <table>
        <tbody>
          <tr><td><code>status</code></td><td><code>&quot;active&quot;</code>, <code>&quot;due&quot;</code> (a payment can be collected now), <code>&quot;low_balance&quot;</code> (fewer than <code>lowBalancePeriods</code> left) or <code>&quot;closable&quot;</code> (can&apos;t fund a full period)</td></tr>
          <tr><td><code>balance</code></td><td>Shannons available for payments (capacity minus the 226 CKB the cell itself occupies)</td></tr>
          <tr><td><code>periodsRemaining</code></td><td>Whole payments the balance still covers</td></tr>
          <tr><td><code>blocksUntilNextClaim</code></td><td>0 when due</td></tr>
        </tbody>
      </table>
      <h3><code>parseSubscription(cell, deployment?)</code></h3>
      <p>Validates one cell and returns <code>{"{ cell, terms, typeId, subscriberLockHash }"}</code>, or <code>undefined</code>.</p>

      <h2>Helpers and constants</h2>
      <table>
        <tbody>
          <tr><td><code>explainScriptError(message)</code></td><td>Turns a rejected transaction&apos;s error text into a name such as <code>ClaimTooEarly</code></td></tr>
          <tr><td><code>ERROR_CODES</code></td><td>Exit code → name map</td></tr>
          <tr><td><code>subscriptionOccupiedCapacity()</code></td><td>226 CKB in shannons: the refundable deposit every subscription cell holds</td></tr>
          <tr><td><code>minPayoutCapacity(lock)</code></td><td>Smallest cell the creator&apos;s lock can receive (about 61 CKB for a standard lock), which is also the lowest valid <code>amount</code></td></tr>
          <tr><td><code>encodeTerms</code> / <code>decodeTerms</code> / <code>validateTerms</code></td><td>The 56-byte cell data format</td></tr>
          <tr><td><code>subscriptionTypeScript</code>, <code>proxyLockFor</code>, <code>typeIdFor</code></td><td>Low-level script construction</td></tr>
          <tr><td><code>TESTNET</code></td><td>Code hashes and cell deps for the testnet deployment</td></tr>
          <tr><td><code>MIN_INTERVAL_BLOCKS</code></td><td>100</td></tr>
          <tr><td><code>MAX_CANCEL_FEE</code></td><td>0.01 CKB: the most a cancel may spend on fees from the subscription itself</td></tr>
        </tbody>
      </table>

      <h2>A keeper in twenty lines</h2>
      <Code lang="ts">{`
import { ccc } from "@ckb-ccc/core";
import { findSubscriptions, viewSubscription, buildClaimTx } from "cadencepay";

const client = new ccc.ClientPublicTestnet();
const keeper = new ccc.SignerCkbPrivateKey(client, process.env.KEEPER_KEY!); // pays fees only
const creator = (await ccc.Address.fromString(process.env.CREATOR!, client)).script;

const tip = await client.getTipHeader();
for (const sub of await findSubscriptions(client, { recipientLockHash: creator.hash() })) {
  if (viewSubscription(sub, tip.number).status !== "due") continue;
  const tx = await buildClaimTx({ subscription: sub, recipientLock: creator, tip: { hash: tip.hash, number: tip.number }, keeper });
  console.log(await keeper.sendTransaction(tx));
}
`}</Code>
    </>
  );
}
