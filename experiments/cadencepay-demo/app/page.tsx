import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-6 py-24">
        <div className="mb-4 text-sm font-mono text-neutral-500">
          Built on CKB · Powered by CadencePay
        </div>
        <h1 className="text-5xl font-bold mb-6 leading-tight">
          Subscribe to creators.<br />
          <span className="text-neutral-400">On-chain. Trustless.</span>
        </h1>
        <p className="text-neutral-400 text-xl mb-12 max-w-2xl">
          CadencePay is a cell-native recurring payment protocol on CKB.
          Subscription agreements live on-chain as CKB cells. Subscribers
          keep custody of their funds. No custodian. No vault.
        </p>
        <div className="flex gap-4 flex-wrap">
          <Link href="/subscribe"
            className="bg-white text-black px-8 py-3 font-semibold hover:bg-neutral-200 transition">
            Subscribe to a Creator
          </Link>
          <Link href="/creator"
            className="border border-neutral-700 px-8 py-3 font-semibold hover:border-neutral-400 transition">
            I'm a Creator
          </Link>
          <Link href="/dashboard"
            className="border border-neutral-700 px-8 py-3 font-semibold hover:border-neutral-400 transition">
            Dashboard
          </Link>
        </div>
        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8 text-sm">
          <div>
            <div className="text-lg font-bold mb-2">On-chain state</div>
            <div className="text-neutral-500">Every subscription is a CKB cell.
            Verifiable by anyone, no database required.</div>
          </div>
          <div>
            <div className="text-lg font-bold mb-2">Self-custody</div>
            <div className="text-neutral-500">Funds stay in the subscriber's
            cells. No vault. Cancel at any time.</div>
          </div>
          <div>
            <div className="text-lg font-bold mb-2">Fiber settlement</div>
            <div className="text-neutral-500">Claims settle via Fiber Network.
            Instant, sub-cent fees.</div>
          </div>
        </div>
      </div>
    </main>
  );
}
