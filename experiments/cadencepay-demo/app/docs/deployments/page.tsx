import type { Metadata } from "next";
import { Code } from "@/components/docs/Code";
import { TESTNET } from "@/lib/cadencepay-sdk";

export const metadata: Metadata = { title: "Deployments" };

const EXPLORER = "https://testnet.explorer.nervos.org/transaction/";

const E2E: [string, string, string][] = [
  ["Join", "0x7b639369604f517879bb59ed0d70f87f890decb0f0fcf543ed2ca8bbdc18dd12", "100 CKB to the creator, 526 CKB saved"],
  ["Collect", "0x4b0dac73", "+100 CKB to the creator"],
  ["Collect", "0x15297227", "+100 CKB to the creator"],
  ["Top up", "0x679ca6b8", "Balance back to 526 CKB"],
  ["Cancel", "0x96925887", "Everything refunded to the member"],
];

export default function Deployments() {
  return (
    <>
      <h1>Deployments</h1>
      <p className="lede">CadencePay is live on CKB <strong>testnet</strong>. Both scripts use <code>hash_type: data1</code>, so the code can never be swapped under existing cells.</p>

      <h2>Testnet</h2>
      <table>
        <thead><tr><th>Script</th><th>Code hash</th><th>Cell dep</th></tr></thead>
        <tbody>
          <tr>
            <td><strong>CadencePay v3</strong></td>
            <td><code>{TESTNET.cadencepay.codeHash}</code></td>
            <td><a href={EXPLORER + TESTNET.cadencepay.cellDep.outPoint.txHash} target="_blank" rel="noreferrer"><code>{String(TESTNET.cadencepay.cellDep.outPoint.txHash).slice(0, 12)}…</code></a> #{Number(TESTNET.cadencepay.cellDep.outPoint.index)}</td>
          </tr>
          <tr>
            <td><strong>Input Type Proxy Lock</strong></td>
            <td><code>{TESTNET.inputTypeProxyLock.codeHash}</code></td>
            <td><a href={EXPLORER + TESTNET.inputTypeProxyLock.cellDep.outPoint.txHash} target="_blank" rel="noreferrer"><code>{String(TESTNET.inputTypeProxyLock.cellDep.outPoint.txHash).slice(0, 12)}…</code></a> #{Number(TESTNET.inputTypeProxyLock.cellDep.outPoint.index)}</td>
          </tr>
        </tbody>
      </table>
      <p>The proxy lock is the audited build from <a href="https://github.com/ckb-devrel/ckb-proxy-locks" target="_blank" rel="noreferrer">ckb-devrel/ckb-proxy-locks</a>.</p>
      <p>The same values ship in the SDK:</p>
      <Code lang="ts">{`import { TESTNET } from "cadencepay";`}</Code>

      <h2>Verified end to end</h2>
      <p>One real membership, signed with JoyID, through every member action:</p>
      <table>
        <thead><tr><th>Step</th><th>Transaction</th><th>Result</th></tr></thead>
        <tbody>
          {E2E.map(([step, tx, result]) => (
            <tr key={tx}><td>{step}</td><td><code>{tx.slice(0, 10)}…</code></td><td>{result}</td></tr>
          ))}
        </tbody>
      </table>

      <h2>Mainnet</h2>
      <p>Not deployed. It will need an audit first.</p>
    </>
  );
}
