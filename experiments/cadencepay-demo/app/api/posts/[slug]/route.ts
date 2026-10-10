import { NextRequest, NextResponse } from "next/server";
import { ccc } from "@ckb-ccc/core";
import { getCreator, tierForSubscription, tierRank } from "@/lib/creators";
import { POST_BODIES } from "@/lib/posts.server";
import { OwnershipError, provenLock } from "@/lib/ownership.server";
import { challengeMessage, CHALLENGE_TTL_MS } from "@/lib/challenge";
import { findSubscriptions, viewSubscription } from "@/lib/cadencepay-sdk";

/**
 * Member-only posts. The caller proves they control `address` with a signed,
 * time-limited challenge; the server then checks CKB testnet for a live
 * Subscription Cell from that address to this creator. Content unlocks only
 * while such a cell exists and can still fund a payment.
 */
/** Public posts need no proof. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const creator = getCreator(slug);
  if (!creator) return NextResponse.json({ error: "Unknown creator" }, { status: 404 });
  const bodies = POST_BODIES[slug] ?? {};
  const posts = creator.posts.filter((p) => p.tierId === null).map((p) => ({ id: p.id, body: bodies[p.id] ?? "" }));
  return NextResponse.json({ tierId: null, posts });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const creator = getCreator(slug);
  if (!creator) return NextResponse.json({ error: "Unknown creator" }, { status: 404 });

  let body: { address?: unknown; issuedAt?: unknown; signature?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { address, issuedAt, signature } = body;
  const sig = signature as Partial<ccc.Signature> | undefined;
  if (
    typeof address !== "string" || !/^ck[bt]1[0-9a-z]{20,200}$/.test(address) ||
    typeof issuedAt !== "number" ||
    !sig || typeof sig.signature !== "string" || typeof sig.identity !== "string" || typeof sig.signType !== "string"
  ) {
    return NextResponse.json({ error: "Expected { address, issuedAt, signature }" }, { status: 400 });
  }
  if (Math.abs(Date.now() - issuedAt) > CHALLENGE_TTL_MS) {
    return NextResponse.json({ error: "Challenge expired; please sign again" }, { status: 401 });
  }

  const client = new ccc.ClientPublicTestnet();
  let lock: ccc.Script;
  try {
    lock = await provenLock(client, address, challengeMessage(slug, address, issuedAt), sig as ccc.Signature);
  } catch (e) {
    const msg = e instanceof OwnershipError ? e.message : "Could not verify the signature";
    return NextResponse.json({ error: msg }, { status: 401 });
  }

  const recipient = await ccc.Address.fromString(creator.payoutAddress, client);
  const [tip, subs] = await Promise.all([
    client.getTipHeader(),
    findSubscriptions(client, { subscriberLockHash: lock.hash(), recipientLockHash: recipient.script.hash() }),
  ]);

  let rank = -1;
  let tierId: string | null = null;
  for (const s of subs) {
    if (viewSubscription(s, tip.number).status === "closable") continue; // out of funds = not a valid membership
    const tier = tierForSubscription(creator, s.terms.amount, s.terms.intervalBlocks);
    if (tier && tierRank(creator, tier.id) > rank) {
      rank = tierRank(creator, tier.id);
      tierId = tier.id;
    }
  }

  const bodies = POST_BODIES[slug] ?? {};
  const posts = creator.posts
    .filter((p) => tierRank(creator, p.tierId) <= rank)
    .map((p) => ({ id: p.id, body: bodies[p.id] ?? "" }));

  return NextResponse.json(
    { tierId, posts },
    { headers: { "Cache-Control": "no-store" } },
  );
}
