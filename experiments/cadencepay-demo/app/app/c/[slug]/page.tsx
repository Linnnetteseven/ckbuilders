import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCreator } from "@/lib/creators";
import { CreatorView } from "./CreatorView";
import { CommunityCreator } from "./CommunityCreator";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const creator = getCreator((await params).slug);
  return creator ? { title: creator.name, description: `${creator.craft}. ${creator.bio}` } : {};
}

export default async function CreatorPage({ params }: Props) {
  const { slug } = await params;
  // Creators who signed up live on-chain ("u-" slugs) and load in the browser
  if (/^u-[0-9a-f]{16}$/.test(slug)) return <CommunityCreator slug={slug} />;
  if (!getCreator(slug)) notFound();
  return <CreatorView slug={slug} />;
}
