import type { Metadata } from "next";
import { Code } from "@/components/docs/Code";
import { ERROR_CODES } from "@/lib/cadencepay-sdk";

export const metadata: Metadata = { title: "On-chain rules" };

const MEANING: Record<string, string> = {
  InvalidArgs: "Type args aren't exactly 64 bytes",
  InvalidDataSize: "Cell data isn't exactly 56 bytes",
  InvalidGroupShape: "The transaction has a CadencePay shape that matches no mode",
  TypeIdInvalid: "The new cell's id isn't derived from its first input (Type ID)",
  NoHeader: "A collect needs a recent block header in header_deps",
  ClaimTooEarly: "The next payment isn't due yet",
  ScheduleNotAdvanced: "A collect must move the next payment exactly one period forward",
  FieldsChanged: "Terms changed during a top-up or collect",
  LockChanged: "The cell's lock changed",
  CapacityMismatch: "A collect didn't shrink the cell by exactly one payment",
  PayoutMissing: "No output pays exactly the amount to the creator",
  MultipleSubscriptions: "More than one CadencePay input in one transaction",
  SubscriberAuthMissing: "Join, top-up and cancel need an input from the member's own lock",
  RefundMissing: "Cancel or close didn't return the balance to the member",
  InvalidTerms: "Amount, interval or creator are invalid (e.g. interval under 100 blocks)",
  WrongLock: "The new cell isn't locked by the proxy lock pointing at itself",
  InsufficientCapacity: "Not enough capacity for the cell plus one payment",
  Overflow: "Arithmetic overflow",
  BalanceSufficient: "Close was attempted while a full payment is still funded",
  InvalidStart: "The schedule starts before the current block (no backdating)",
  Syscall: "A low-level CKB syscall failed",
};

export default function Rules() {
  return (
    <>
      <h1>On-chain <em>rules</em></h1>
      <p className="lede">
        All of CadencePay&apos;s guarantees come from one type script. The SDK and the demo are just convenient ways to build transactions it will accept.
      </p>

      <h2>The cell</h2>
      <table>
        <thead><tr><th>Part</th><th>Contents</th></tr></thead>
        <tbody>
          <tr><td><strong>Lock</strong></td><td>Input Type Proxy Lock, args = hash of this cell&apos;s own type script. It passes whenever the cell&apos;s type script runs, so the type script is the only authority.</td></tr>
          <tr><td><strong>Type args</strong> (64 bytes)</td><td><code>type_id</code> (32) · <code>subscriber_lock_hash</code> (32)</td></tr>
          <tr><td><strong>Data</strong> (56 bytes)</td><td><code>recipient_lock_hash</code> (32) · <code>amount</code> u64 · <code>interval_blocks</code> u64 · <code>next_claim_block</code> u64 (little-endian)</td></tr>
        </tbody>
      </table>

      <h2>Modes</h2>
      <p>The script chooses a mode from how many CadencePay cells are in the transaction&apos;s inputs and outputs. Only one subscription may be spent per transaction.</p>
      <table>
        <thead><tr><th>Mode</th><th>Shape</th><th>Who</th><th>Checks</th></tr></thead>
        <tbody>
          <tr><td><strong>Join</strong></td><td>0 → 1</td><td>member</td><td>Member&apos;s input present, Type ID valid, terms valid, correct proxy lock, enough capacity for a payment</td></tr>
          <tr><td><strong>Collect</strong></td><td>1 → 1</td><td>anyone</td><td>Header block ≥ next payment; an output pays exactly <code>amount</code> to the creator; cell shrinks by exactly <code>amount</code>; schedule moves forward one period; nothing else changes</td></tr>
          <tr><td><strong>Top up</strong></td><td>1 → 1</td><td>member</td><td>Member&apos;s input present; capacity grows; data and lock unchanged</td></tr>
          <tr><td><strong>Cancel</strong></td><td>1 → 0</td><td>member</td><td>Member&apos;s input present; the balance minus at most 0.01 CKB fee goes back to the member</td></tr>
          <tr><td><strong>Close</strong></td><td>1 → 0</td><td>anyone</td><td>Balance is below one payment; all of it goes to the member</td></tr>
        </tbody>
      </table>
      <p>
        The schedule is <strong>anchored</strong>: each collect sets <code>next_claim_block += interval</code>, not &ldquo;now + interval&rdquo;. A creator who misses a few periods can catch up, but only one payment per transaction, and never ahead of time.
      </p>

      <h2>Error codes</h2>
      <p>When the script rejects a transaction, the node reports its exit code. <code>explainScriptError</code> maps it for you.</p>
      <table>
        <thead><tr><th>Code</th><th>Name</th><th>Meaning</th></tr></thead>
        <tbody>
          {Object.entries(ERROR_CODES).map(([code, name]) => (
            <tr key={code}><td className="tnum">{code}</td><td><code>{name}</code></td><td>{MEANING[name] ?? ""}</td></tr>
          ))}
        </tbody>
      </table>

      <h2>Build and test it yourself</h2>
      <Code lang="bash">{`
git clone https://github.com/Linnnetteseven/ckbuilders
cd ckbuilders/experiments/time-lock-script
make build CLANG=clang-16 CUSTOM_RUSTFLAGS=""   # reproducible: code hash 0x7c271b62…0419
cargo test -p tests cadencepay_v3                # 46 attack tests
`}</Code>
    </>
  );
}
