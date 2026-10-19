/**
 * Creator profiles stored on-chain, so anyone can sign up without a database.
 *
 * A profile is one cell:
 *  - lock = the creator's own wallet lock. Payments always go to this lock,
 *    and only the creator can edit or remove the profile.
 *  - type = always-success (ckb-proxy-locks deployment) with a fixed marker in
 *    args, so every profile can be found with one exact search.
 *  - data = a small JSON document (name, bio, tiers).
 *
 * Anyone can create a cell with someone else's lock, so a profile only counts
 * if the transaction that created it also spent a cell with that same lock,
 * i.e. the creator signed it.
 */
import { ccc } from "@ckb-ccc/core";
import { SHANNONS_PER_CKB } from "@/lib/cadencepay-sdk";
import { BLOCKS_PER_HOUR, type Creator, type Tier } from "@/lib/creators";

export const PROFILE_TYPE = ccc.Script.from({
  codeHash: "0x3b521cc4b552f109d092d8cc468a8048acb53c5952dbe769d2b2f9cf6e47f7f1",
  hashType: "data1",
  args: ccc.hexFrom(ccc.bytesFrom("cadencepay-profile-v1", "utf8")),
});
const ALWAYS_SUCCESS_DEP = ccc.CellDep.from({
  outPoint: { txHash: "0xb4f171c9c9caf7401f54a8e56225ae21d95032150a87a4678eac3f66a3137b93", index: 0 },
  depType: "code",
});

export const HUES = ["#C44F6B", "#2B6C50", "#3A4BC4", "#B4570F", "#6B3FA0", "#1F2937"] as const;
export const PERIODS = {
  hour: { blocks: BLOCKS_PER_HOUR, label: "every hour" },
  day: { blocks: BLOCKS_PER_HOUR * 24n, label: "every day" },
  week: { blocks: BLOCKS_PER_HOUR * 24n * 7n, label: "every week" },
} as const;
export type Period = keyof typeof PERIODS;

export const LIMITS = { name: 40, craft: 60, bio: 240, tierName: 24, perk: 60, perks: 3, tiers: 3, minCkb: 70, maxCkb: 100_000 };

export interface ProfileTier { name: string; ckb: number; every: Period; perks: string[] }
export interface ProfileData { v: 1; name: string; craft: string; bio: string; hue: string; tiers: ProfileTier[] }

const text = (v: unknown, max: number, min = 1) => {
  if (typeof v !== "string") throw new Error("Expected text");
  const t = v.trim().replace(/\s+/g, " ");
  if (t.length < min || t.length > max) throw new Error(`Text must be ${min}–${max} characters`);
  return t;
};

/** Validate and normalise profile data (from the form or from the chain). Throws a readable message. */
export function validateProfile(raw: unknown): ProfileData {
  const d = raw as Record<string, unknown>;
  if (!d || typeof d !== "object") throw new Error("Invalid profile");
  const hue = typeof d.hue === "string" && (HUES as readonly string[]).includes(d.hue) ? d.hue : HUES[0];
  if (!Array.isArray(d.tiers) || d.tiers.length < 1 || d.tiers.length > LIMITS.tiers) throw new Error(`Add 1 to ${LIMITS.tiers} tiers`);
  const tiers = d.tiers.map((t: Record<string, unknown>) => {
    const ckb = Number(t?.ckb);
    if (!Number.isInteger(ckb) || ckb < LIMITS.minCkb || ckb > LIMITS.maxCkb) throw new Error(`Tier prices must be whole numbers from ${LIMITS.minCkb} to ${LIMITS.maxCkb} CKB`);
    const every = t?.every as Period;
    if (!(every in PERIODS)) throw new Error("Choose how often members pay");
    const perks = Array.isArray(t?.perks) ? t.perks.filter((p) => typeof p === "string" && p.trim()).slice(0, LIMITS.perks).map((p) => text(p, LIMITS.perk)) : [];
    return { name: text(t?.name, LIMITS.tierName), ckb, every, perks };
  });
  return { v: 1, name: text(d.name, LIMITS.name, 2), craft: text(d.craft, LIMITS.craft, 2), bio: text(d.bio, LIMITS.bio, 0), hue, tiers };
}

export const encodeProfile = (p: ProfileData) => ccc.bytesFrom(JSON.stringify(validateProfile(p)), "utf8");

/** URL slug for a profile: "u-" + the first 8 bytes of the creator's lock hash. */
export const profileSlug = (lock: ccc.Script) => `u-${lock.hash().slice(2, 18)}`;

export interface Profile { cell: ccc.Cell; data: ProfileData; creator: Creator }

function toCreator(data: ProfileData, lock: ccc.Script, client: ccc.Client): Creator {
  const words = data.name.split(" ").filter(Boolean);
  const tiers: Tier[] = data.tiers.map((t, i) => ({
    id: `t${i}`,
    name: t.name,
    amount: BigInt(t.ckb) * SHANNONS_PER_CKB,
    intervalBlocks: PERIODS[t.every].blocks,
    intervalLabel: PERIODS[t.every].label,
    prefundPeriods: 3n,
    perks: t.perks,
  }));
  return {
    slug: profileSlug(lock),
    name: data.name,
    craft: data.craft,
    bio: data.bio,
    initials: ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? words[0]?.[1] ?? "")).toUpperCase(),
    hue: data.hue,
    // Payouts always go to the lock that owns the profile, so they can't be redirected
    payoutAddress: ccc.Address.fromScript(lock, client).toString(),
    tiers,
    posts: [],
  };
}

/** True if the tx that created `cell` spent an input with the same lock (the creator signed it). */
async function signedByOwner(client: ccc.Client, cell: ccc.Cell): Promise<boolean> {
  const res = await client.getTransaction(cell.outPoint.txHash);
  if (!res) return false;
  for (const input of res.transaction.inputs) {
    if ((await input.getCell(client)).cellOutput.lock.eq(cell.cellOutput.lock)) return true;
  }
  return false;
}

function parse(cell: ccc.Cell, client: ccc.Client): Profile | undefined {
  if (!cell.cellOutput.type?.eq(PROFILE_TYPE)) return undefined;
  try {
    const data = validateProfile(JSON.parse(ccc.bytesTo(cell.outputData, "utf8")));
    return { cell, data, creator: toCreator(data, cell.cellOutput.lock, client) };
  } catch {
    return undefined;
  }
}

/** Every valid, owner-signed profile; one per creator (the latest found). */
export async function findProfiles(client: ccc.Client, limit = 60): Promise<Profile[]> {
  const byLock = new Map<string, Profile>();
  for await (const cell of client.findCellsByType(PROFILE_TYPE, true)) {
    const p = parse(cell, client);
    if (p) byLock.set(cell.cellOutput.lock.hash(), p);
    if (byLock.size >= limit) break;
  }
  const checked = await Promise.all([...byLock.values()].map(async (p) => ((await signedByOwner(client, p.cell)) ? p : undefined)));
  return checked.filter((p): p is Profile => p !== undefined);
}

export async function findProfileBySlug(client: ccc.Client, slug: string): Promise<Profile | undefined> {
  return (await findProfiles(client)).find((p) => p.creator.slug === slug);
}

/** The connected wallet's own profile, if it has one. */
export async function findMyProfile(client: ccc.Client, lock: ccc.Script): Promise<Profile | undefined> {
  for await (const cell of client.findCells({ script: lock, scriptType: "lock", scriptSearchMode: "exact", filter: { script: PROFILE_TYPE } }, "desc")) {
    const p = parse(cell, client);
    if (p) return p;
  }
  return undefined;
}

/** Publish or update a profile. Editing consumes the old cell, so its deposit carries over. */
export async function buildProfileTx(signer: ccc.Signer, data: ProfileData, existing?: Profile): Promise<ccc.Transaction> {
  const { script: lock } = await signer.getRecommendedAddressObj();
  const tx = ccc.Transaction.from({
    inputs: existing ? [{ previousOutput: existing.cell.outPoint }] : [],
    outputs: [{ lock, type: PROFILE_TYPE }],
    outputsData: [encodeProfile(data)],
  });
  tx.addCellDeps(ALWAYS_SUCCESS_DEP);
  // A fresh profile must spend one of the creator's own cells (proof they signed it)
  await tx.completeInputsAtLeastOne(signer);
  await tx.completeInputsByCapacity(signer);
  await tx.completeFeeBy(signer);
  return tx;
}

/** Remove a profile; its deposit comes back to the creator. */
export async function buildRemoveProfileTx(signer: ccc.Signer, existing: Profile): Promise<ccc.Transaction> {
  const tx = ccc.Transaction.from({ inputs: [{ previousOutput: existing.cell.outPoint }] });
  tx.addCellDeps(ALWAYS_SUCCESS_DEP);
  await tx.completeFeeBy(signer);
  return tx;
}

/** CKB locked by a profile cell (refundable). */
export function profileDeposit(data: ProfileData, lock: ccc.Script): bigint {
  const out = ccc.CellOutput.from({ capacity: 0, lock, type: PROFILE_TYPE });
  return BigInt(out.occupiedSize + encodeProfile(data).length) * SHANNONS_PER_CKB;
}
