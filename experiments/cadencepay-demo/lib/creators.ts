/**
 * Demo creators (fictional). Public data only: profile, tiers and post
 * teasers. Post bodies live in lib/posts.server.ts and are only returned by
 * /api/posts after an on-chain membership check.
 *
 * Payout addresses are testnet accounts controlled by the project owner.
 */
import { SHANNONS_PER_CKB } from "@/lib/cadencepay-sdk";

/** CKB testnet: ~8 s blocks → ~450 blocks per hour. */
export const BLOCKS_PER_HOUR = 450n;

export interface Tier {
  id: string;
  name: string;
  /** shannons per interval; ≥ 61 CKB so keepers can pay it out */
  amount: bigint;
  intervalBlocks: bigint;
  intervalLabel: string;
  /** periods kept in the cell after the first upfront payment */
  prefundPeriods: bigint;
  perks: string[];
}

export interface PostMeta {
  id: string;
  title: string;
  date: string;
  /** null = public */
  tierId: string | null;
  teaser: string;
}

export interface Creator {
  slug: string;
  name: string;
  craft: string;
  bio: string;
  initials: string;
  /** cover banner colour */
  hue: string;
  payoutAddress: string;
  tiers: Tier[];
  posts: PostMeta[];
}

const ckb = (n: number) => BigInt(n) * SHANNONS_PER_CKB;

export const CREATORS: Creator[] = [
  {
    slug: "wanjiru-frames",
    name: "Wanjiru Frames",
    craft: "Street photography from Nairobi",
    bio: "Long walks from River Road to Kibera with a 35mm. Members get the full contact sheets, the stories behind each frame, and a monthly print vote.",
    initials: "WF",
    hue: "#C44F6B",
    payoutAddress:
      "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqt435c3epyrupszm7khk6weq5lrlyt52lg48ucew",
    tiers: [
      {
        id: "supporter",
        name: "Supporter",
        amount: ckb(100),
        intervalBlocks: BLOCKS_PER_HOUR,
        intervalLabel: "every hour",
        prefundPeriods: 3n,
        perks: ["Full contact sheets", "Behind-the-frame notes"],
      },
      {
        id: "darkroom",
        name: "Darkroom",
        amount: ckb(250),
        intervalBlocks: BLOCKS_PER_HOUR,
        intervalLabel: "every hour",
        prefundPeriods: 2n,
        perks: ["Everything in Supporter", "Monthly print vote", "Raw files of your favourite frame"],
      },
    ],
    posts: [
      { id: "kenyatta-ave", title: "Kenyatta Avenue at 6:40 am", date: "2026-10-02", tierId: null, teaser: "Why I shoot the city before it wakes up." },
      { id: "contact-sheet-14", title: "Contact sheet #14: Gikomba market", date: "2026-10-05", tierId: "supporter", teaser: "36 frames, 3 keepers, and the one I almost deleted." },
      { id: "print-vote-oct", title: "October print vote", date: "2026-10-06", tierId: "darkroom", teaser: "Pick the frame I print large this month." },
    ],
  },
  {
    slug: "otieno-builds",
    name: "Otieno Builds",
    craft: "CKB tutorials in Swahili and English",
    bio: "Short, honest lessons on cells, scripts and CCC, recorded in Kisumu. Members get the code, the slides, and Friday office hours.",
    initials: "OB",
    hue: "#2B6C50",
    payoutAddress:
      "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqtqq998uz0kwlmdkml8f95uefpme6xrlhcq4q709",
    tiers: [
      {
        id: "learner",
        name: "Learner",
        amount: ckb(80),
        intervalBlocks: BLOCKS_PER_HOUR,
        intervalLabel: "every hour",
        prefundPeriods: 3n,
        perks: ["Lesson code and slides", "Swahili transcripts"],
      },
    ],
    posts: [
      { id: "cells-101", title: "Seli ni nini? Cells in 7 minutes", date: "2026-09-29", tierId: null, teaser: "The landlord analogy that finally made cells click for my class." },
      { id: "type-id-lab", title: "Lab: build a Type ID cell with CCC", date: "2026-10-04", tierId: "learner", teaser: "Step-by-step code, plus the three mistakes everyone makes." },
    ],
  },
  {
    slug: "matatu-sound",
    name: "Matatu Sound",
    craft: "Gengetone and amapiano mixes",
    bio: "Mixes built for the Route 46 commute. Members get the full-length sets and the stems for remixing.",
    initials: "MS",
    hue: "#3A4BC4",
    payoutAddress:
      "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqftnd97fwa3yvlawpr0c5m2fgsrs49plygffl44q",
    tiers: [
      {
        id: "rider",
        name: "Rider",
        amount: ckb(120),
        intervalBlocks: BLOCKS_PER_HOUR,
        intervalLabel: "every hour",
        prefundPeriods: 3n,
        perks: ["Full-length sets", "Track lists"],
      },
    ],
    posts: [
      { id: "route-46", title: "Route 46: a 20-minute teaser mix", date: "2026-10-01", tierId: null, teaser: "The first stretch, from Kencom to Yaya." },
      { id: "stems-vol-3", title: "Stems vol. 3", date: "2026-10-06", tierId: "rider", teaser: "Drums, bass and vocal stems for remixing." },
    ],
  },
];

export function getCreator(slug: string): Creator | undefined {
  return CREATORS.find((c) => c.slug === slug);
}

/** Rank of a tier (index in the creator's list); higher index = higher tier. */
export function tierRank(creator: Creator, tierId: string | null): number {
  return tierId === null ? -1 : creator.tiers.findIndex((t) => t.id === tierId);
}

/**
 * Highest tier a live subscription qualifies for: same interval and an
 * amount at least the tier price. Returns undefined if none matches.
 */
export function tierForSubscription(creator: Creator, amount: bigint, intervalBlocks: bigint): Tier | undefined {
  return [...creator.tiers]
    .reverse()
    .find((t) => t.intervalBlocks === intervalBlocks && amount >= t.amount);
}
