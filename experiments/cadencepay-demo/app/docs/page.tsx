import Link from "next/link";

export default function DocsHome() {
  return (
    <>
      <h1>Recurring payments, <em>payer in control.</em></h1>
      <p className="lede">
        CadencePay lets someone pay a creator, a service or a DAO on a schedule without handing over their wallet. It is a single CKB type script plus a small TypeScript SDK.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/docs/quickstart" className="pill">Quickstart</Link>
        <Link href="/app" className="pill pill-outline">Try the demo</Link>
      </div>

      <h2>The idea in one paragraph</h2>
      <p>
        A member creates a <strong>subscription cell</strong> funded from their own wallet. The cell carries its terms: who gets paid, how much, and how often. Once per period anyone can submit a transaction that moves exactly that amount to the creator. That&apos;s safe because the type script checks every spend. The member can top up or cancel at any time, and when a cell runs dry anyone can close it and send the rest back to the member.
      </p>

      <h2>How it compares</h2>
      <table>
        <thead><tr><th></th><th>Card subscription</th><th>Token allowance</th><th>CadencePay</th></tr></thead>
        <tbody>
          <tr><td><strong>Who holds the money</strong></td><td>The merchant charges your card</td><td>You, but the spender can pull up to the allowance from your whole balance</td><td>A cell only the rules can spend, refundable to you</td></tr>
          <tr><td><strong>Most that can be taken per period</strong></td><td>Whatever the merchant charges</td><td>The allowance</td><td>Exactly the agreed amount</td></tr>
          <tr><td><strong>Cancel</strong></td><td>Ask the merchant</td><td>Revoke the approval</td><td>One transaction; everything left comes back</td></tr>
          <tr><td><strong>Needs a server key</strong></td><td>Yes</td><td>Yes, for the puller</td><td>No. Anyone may trigger a due payment</td></tr>
        </tbody>
      </table>

      <h2>The pieces</h2>
      <ul>
        <li><strong>CadencePay v3 type script</strong> (Rust, on-chain). It enforces join, collect, top-up, cancel and close. See <Link href="/docs/rules">On-chain rules</Link>.</li>
        <li><strong>Input Type Proxy Lock.</strong> The cell&apos;s lock just defers to its own type script, so no private key controls the cell.</li>
        <li><strong><code>cadencepay</code> on npm.</strong> It builds unsigned transactions for every action and reads subscriptions from the chain. See the <Link href="/docs/sdk">SDK reference</Link>.</li>
        <li><strong>A keeper</strong> (optional). It&apos;s any process that collects due payments and pays the small network fee. The demo runs one daily as a Vercel cron job, and it holds no member funds.</li>
      </ul>

      <h2>Words used in these docs</h2>
      <table>
        <tbody>
          <tr><td><strong>Member</strong></td><td>The person paying (the subscriber).</td></tr>
          <tr><td><strong>Creator</strong></td><td>Whoever receives each payment (the recipient).</td></tr>
          <tr><td><strong>Period</strong></td><td>A number of blocks between payments. On CKB a block is about 8 seconds, so 450 blocks ≈ 1 hour and 40,320 ≈ 1 week.</td></tr>
          <tr><td><strong>Collect</strong></td><td>One due payment moved to the creator (a &ldquo;claim&rdquo; in the code).</td></tr>
          <tr><td><strong>Close</strong></td><td>Ending a membership that can no longer pay a full period. Anyone may do it; the refund always goes to the member.</td></tr>
        </tbody>
      </table>

      <div className="callout"><p><strong>Status:</strong> CKB testnet only, and not yet audited. Don&apos;t use it with real funds.</p></div>
    </>
  );
}
