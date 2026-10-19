import type { Metadata } from "next";

export const metadata: Metadata = { title: "Security & privacy" };

export default function Security() {
  return (
    <>
      <h1>Security <em>&amp; privacy</em></h1>
      <p className="lede">What CadencePay guarantees, what it trusts, and what it doesn&apos;t protect yet.</p>

      <h2>Guarantees enforced on-chain</h2>
      <ul>
        <li>A creator receives <strong>at most the agreed amount per period</strong>, paid to the address fixed when the member joined.</li>
        <li>Payments can&apos;t be collected early. Missed periods can be caught up only <strong>one payment per transaction</strong>.</li>
        <li>The amount, period, creator and schedule <strong>can&apos;t be changed</strong> after joining, not even by top-ups.</li>
        <li>Only the member can top up or cancel. Cancel returns everything left, minus at most 0.01 CKB in fees.</li>
        <li>A cell that has run out can be closed by anyone, and <strong>all</strong> of it goes back to the member.</li>
        <li>Only the member&apos;s membership balance is ever reachable, never the rest of their wallet.</li>
        <li>No admin key and no upgrades: both scripts are referenced by <code>data1</code> code hash.</li>
      </ul>

      <h2>What it relies on</h2>
      <ul>
        <li><strong>The type script being correct.</strong> It has 46 attack tests and a public threat model, but it has <strong>not been audited</strong>.</li>
        <li><strong>The Input Type Proxy Lock</strong> from <a href="https://github.com/ckb-devrel/ckb-proxy-locks" target="_blank" rel="noreferrer">ckb-proxy-locks</a>.</li>
        <li><strong>Someone running a keeper</strong> so creators get paid. If nobody does, payments simply wait; members lose nothing. Any creator can collect for themselves using a separate wallet to pay the fee.</li>
      </ul>

      <h2>Known limitations</h2>
      <table>
        <thead><tr><th>Limitation</th><th>Effect</th><th>Mitigation</th></tr></thead>
        <tbody>
          <tr><td>Cancel just before a collect</td><td>A creator can lose at most one period</td><td>Joining pays the first period upfront</td></tr>
          <tr><td>Minimum payment</td><td>Each payment must be at least ~61 CKB (the smallest standalone cell)</td><td>The SDK refuses smaller amounts</td></tr>
          <tr><td>Keeper fee</td><td>The keeper pays a tiny network fee per collect</td><td>The demo keeper holds only a few CKB for fees and no member funds</td></tr>
          <tr><td>Public memberships</td><td>See below</td><td>Use a fresh address</td></tr>
        </tbody>
      </table>

      <h2 id="privacy">Privacy: what is public</h2>
      <p>
        CKB is a public ledger. Each membership cell shows <strong>which address supports which creator, for how much and how often</strong>, and every collect is a public, dated payment. Anyone who knows your address can see your memberships.
      </p>

      <h3>Use a fresh address</h3>
      <p>The simplest protection is to join from an address used only for memberships:</p>
      <ol>
        <li>Create a second wallet. In JoyID, add a new account; any other CKB wallet works too.</li>
        <li>Fund it in a way that doesn&apos;t point back to your main address. On testnet, use the <a href="https://faucet.nervos.org" target="_blank" rel="noreferrer">faucet</a>. On mainnet, a direct transfer from your main address links the two on-chain.</li>
        <li>Connect with that account when you join. Refunds from cancel or close go back to it, not to your main wallet.</li>
      </ol>
      <p>This hides who you are, not what you support: the membership itself is still public.</p>

      <h3>On the roadmap</h3>
      <ul>
        <li><strong>Stealth payouts</strong> (via Obscell), so creators&apos; earnings aren&apos;t linkable to one address.</li>
        <li><strong>Private membership proofs</strong>: prove &ldquo;I&apos;m a member&rdquo; to unlock content without revealing which address you are. CKB can verify SP1 zero-knowledge proofs (about 63M cycles).</li>
      </ul>

      <h2>Report a problem</h2>
      <p>Found a bug in the script or SDK? Please open an issue on <a href="https://github.com/Linnnetteseven/ckbuilders/issues" target="_blank" rel="noreferrer">GitHub</a>, or contact the author privately for anything exploitable.</p>
    </>
  );
}
