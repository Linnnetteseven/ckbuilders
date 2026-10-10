import Link from "next/link";
import { Nav } from "@/components/Nav";
import { btn } from "@/components/ui";

export default function NotFound() {
  return (
    <>
      <Nav />
      <main id="main" className="min-h-dvh pt-14 px-4 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <p className="text-xs text-muted tnum mb-3">404</p>
          <h1 className="display text-3xl font-bold mb-3">Nothing lives at this address</h1>
          <p className="text-muted text-sm mb-8">The page or creator you&apos;re looking for doesn&apos;t exist on this demo.</p>
          <Link href="/" className={btn.primary}>Back to creators</Link>
        </div>
      </main>
    </>
  );
}
