import Link from "next/link";
import { Nav } from "@/components/Nav";
import { btn } from "@/components/ui";

export default function NotFound() {
  return (
    <>
      <Nav />
      <main id="main" className="min-h-dvh pt-16 px-4 flex items-center justify-center bg-blush">
        <div className="text-center max-w-md">
          <p className="display-thin text-[7rem] leading-none text-pink tnum">404</p>
          <h1 className="mt-4 text-3xl font-semibold">We couldn&apos;t find that page</h1>
          <p className="text-ink-2 mt-3 mb-8">The page or creator you&apos;re looking for doesn&apos;t exist here.</p>
          <Link href="/" className={btn.primaryLg}>Explore creators</Link>
        </div>
      </main>
    </>
  );
}
