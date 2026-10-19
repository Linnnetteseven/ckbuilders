import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCreator } from "@/lib/creators";
import { CheckoutView } from "./CheckoutView";
import { CommunityCreator } from "../../CommunityCreator";

type Props = { params: Promise<{ slug: string; tier: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, tier } = await params;
  const creator = getCreator(slug);
  const t = creator?.tiers.find((x) => x.id === tier);
  return creator && t ? { title: `Join ${t.name} · ${creator.name}` } : {};
}

export default async function JoinPage({ params }: Props) {
  const { slug, tier } = await params;
  if (/^u-[0-9a-f]{16}$/.test(slug)) return <CommunityCreator slug={slug} tierId={tier} />;
  const creator = getCreator(slug);
  if (!creator || !creator.tiers.some((t) => t.id === tier)) notFound();
  return <CheckoutView slug={slug} tierId={tier} />;
}
