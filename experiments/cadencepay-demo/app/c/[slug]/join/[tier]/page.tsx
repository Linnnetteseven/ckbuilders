import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCreator } from "@/lib/creators";
import { CheckoutView } from "./CheckoutView";

type Props = { params: Promise<{ slug: string; tier: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, tier } = await params;
  const creator = getCreator(slug);
  const t = creator?.tiers.find((x) => x.id === tier);
  return creator && t ? { title: `Join ${t.name} · ${creator.name}` } : {};
}

export default async function JoinPage({ params }: Props) {
  const { slug, tier } = await params;
  const creator = getCreator(slug);
  if (!creator || !creator.tiers.some((t) => t.id === tier)) notFound();
  return <CheckoutView slug={slug} tierId={tier} />;
}
