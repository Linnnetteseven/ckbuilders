"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export const DOCS = [
  { href: "/docs", label: "Introduction" },
  { href: "/docs/quickstart", label: "Quickstart" },
  { href: "/docs/sdk", label: "SDK reference" },
  { href: "/docs/rules", label: "On-chain rules" },
  { href: "/docs/deployments", label: "Deployments" },
  { href: "/docs/security", label: "Security & privacy" },
];

export function DocsNav() {
  const path = usePathname();
  return (
    <nav aria-label="Docs" className="flex lg:flex-col gap-1 overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0 pb-1">
      {DOCS.map((d) => {
        const active = path === d.href;
        return (
          <Link key={d.href} href={d.href} aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-[14.5px] transition-colors ${active ? "bg-blush text-pink font-semibold" : "text-ink-2 hover:text-pink"}`}>
            {d.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Previous / next links at the bottom of each docs page. */
export function DocsPager() {
  const path = usePathname();
  const i = DOCS.findIndex((d) => d.href === path);
  const prev = i > 0 ? DOCS[i - 1] : undefined;
  const next = i >= 0 && i < DOCS.length - 1 ? DOCS[i + 1] : undefined;
  return (
    <div className="mt-16 pt-6 border-t border-line flex justify-between gap-4 text-[15px]">
      {prev ? <Link href={prev.href} className="text-ink-2 hover:text-pink">← {prev.label}</Link> : <span />}
      {next ? <Link href={next.href} className="font-semibold text-pink hover:underline">{next.label} →</Link> : <span />}
    </div>
  );
}
