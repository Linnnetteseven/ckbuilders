"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Alert, Footer, Receipt, Skeleton, btn } from "@/components/ui";
import { Avatar, Cover } from "@/components/Creator";
import { IconArrowRight, IconX } from "@/components/icons";
import { useWallet } from "@/lib/useWallet";
import { friendlyTxError } from "@/lib/txErrors";
import { uploadMessage } from "@/lib/challenge";
import { sha256Hex, toSquareWebp } from "@/lib/imageResize";
import { formatCkb } from "@/lib/cadencepay";
import {
  HUES, LIMITS, PERIODS, buildProfileTx, buildRemoveProfileTx, findMyProfile, profileDeposit, profileSlug, validateProfile,
  type Period, type Profile, type ProfileData, type ProfileTier,
} from "@/lib/profiles";

const BLANK: ProfileData = {
  v: 1, name: "", craft: "", bio: "", hue: HUES[0],
  tiers: [{ name: "Supporter", ckb: 100, every: "week", perks: ["My thanks, and early access", ""] }],
};

/** Timestamp for the signed upload message (kept out of the component for the React compiler). */
const issuedNow = () => Date.now();

const field = "w-full rounded-2xl border border-line bg-white px-4 py-3 text-[15px] outline-none transition-colors focus:border-pink";
const label = "block text-sm font-semibold mb-1.5";

export default function Start() {
  const { signer, client, lock, address, connect } = useWallet();
  const [mine, setMine] = useState<{ owner: string; profile: Profile | null } | null>(null);
  const [draft, setDraft] = useState<ProfileData>(BLANK);
  const [busy, setBusy] = useState<"" | "publish" | "remove">("");
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<{ label: string; txHash: string } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [uploading, setUploading] = useState(false);

  const owner = lock?.hash();
  const existing = mine && mine.owner === owner ? mine.profile : undefined;

  // Load the connected wallet's profile (if any) and start editing from it
  useEffect(() => {
    if (!lock) return;
    const o = lock.hash();
    let cancelled = false;
    findMyProfile(client, lock)
      .then((p) => {
        if (cancelled) return;
        setMine({ owner: o, profile: p ?? null });
        if (p) setDraft({ ...p.data, tiers: p.data.tiers.map((t) => ({ ...t, perks: [...t.perks, ""].slice(0, LIMITS.perks) })) });
      })
      .catch(() => { if (!cancelled) setMine({ owner: o, profile: null }); });
    return () => { cancelled = true; };
  }, [client, lock, refresh]);

  const check = useMemo(() => {
    try { return { ok: validateProfile(draft), msg: "" }; } catch (e) { return { ok: null, msg: e instanceof Error ? e.message : "Check the form" }; }
  }, [draft]);

  const previewCreator = useMemo(() => ({
    slug: lock ? profileSlug(lock) : "preview", name: draft.name || "Your name", craft: draft.craft || "What you make",
    bio: draft.bio, initials: (draft.name.trim().split(" ").map((w) => w[0]).join("").slice(0, 2) || "YN").toUpperCase(),
    hue: draft.hue, payoutAddress: "", tiers: [], posts: [],
    image: draft.img ? { src: draft.img, cover: "50% 40%", face: "50% 35%", zoom: 1.3 } : undefined,
  }), [draft, lock]);

  // Shrink the photo here, have the wallet sign its fingerprint, then upload it
  const chooseImage = async (file: File | undefined) => {
    if (!file || !signer || !address) return;
    setUploading(true); setError("");
    try {
      const webp = await toSquareWebp(file);
      const issuedAt = issuedNow();
      const signature = await signer.signMessage(uploadMessage(address, await sha256Hex(webp), issuedAt));
      const form = new FormData();
      form.set("file", webp, "image.webp");
      form.set("address", address);
      form.set("issuedAt", String(issuedAt));
      form.set("signature", JSON.stringify(signature));
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const d = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !d.url) throw new Error(d.error ?? "Upload failed");
      set({ img: d.url });
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "We couldn't upload that image");
    } finally { setUploading(false); }
  };

  const set = (patch: Partial<ProfileData>) => setDraft((d) => ({ ...d, ...patch }));
  const setTier = (i: number, patch: Partial<ProfileTier>) => setDraft((d) => ({ ...d, tiers: d.tiers.map((t, k) => (k === i ? { ...t, ...patch } : t)) }));

  const publish = async () => {
    if (!signer || !check.ok) return;
    setBusy("publish"); setError("");
    try {
      const tx = await buildProfileTx(signer, check.ok, existing ?? undefined);
      const txHash = await signer.sendTransaction(tx);
      setReceipt({ label: existing ? "Your page is updated" : "Your creator page is live", txHash });
      for (const ms of [5000, 12000]) setTimeout(() => setRefresh((n) => n + 1), ms);
    } catch (e) {
      setError(friendlyTxError(e));
    } finally { setBusy(""); }
  };

  const remove = async () => {
    if (!signer || !existing) return;
    setBusy("remove"); setError(""); setConfirmRemove(false);
    try {
      const txHash = await signer.sendTransaction(await buildRemoveProfileTx(signer, existing));
      setReceipt({ label: `Page removed. ${formatCkb(existing.cell.cellOutput.capacity)} CKB is back in your wallet`, txHash });
      setDraft(BLANK);
      for (const ms of [5000, 12000]) setTimeout(() => setRefresh((n) => n + 1), ms);
    } catch (e) {
      setError(friendlyTxError(e));
    } finally { setBusy(""); }
  };

  const deposit = check.ok && lock ? profileDeposit(check.ok, lock) : null;

  return (
    <>
      <Nav />
      <main id="main" className="pt-16 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="mt-12 display-thin text-5xl sm:text-7xl max-w-[14ch]">Start your <span className="text-pink font-serif italic font-normal tracking-[-0.02em]">creator page.</span></h1>
          <p className="mt-4 text-lg text-ink-2 max-w-[52ch]">
            Set your tiers and share the link. Members pay you straight to your own wallet, once each period. Your page is saved on the network, so there&apos;s no account to create.
          </p>

          <div className="space-y-3 mt-8">
            {error && <Alert>{error}</Alert>}
            {receipt && <Receipt label={receipt.label} txHash={receipt.txHash} />}
          </div>

          {!signer ? (
            <div className="mt-8 rounded-3xl bg-blush px-6 py-14 text-center">
              <h2 className="text-2xl font-semibold">Connect the wallet you want to be paid in</h2>
              <p className="text-ink-2 mt-2 mb-7 max-w-md mx-auto">Payments from members go straight to this wallet. Nobody, including us, can change where your money goes.</p>
              <button onClick={() => void connect()} className={btn.primaryLg}>Connect wallet</button>
            </div>
          ) : existing === undefined ? (
            <div className="mt-8 grid lg:grid-cols-2 gap-8"><Skeleton className="h-96" /><Skeleton className="h-96" /></div>
          ) : (
            <div className="mt-8 grid lg:grid-cols-[1.1fr_1fr] gap-8 lg:gap-12 items-start">
              <form onSubmit={(e) => { e.preventDefault(); void publish(); }} className="space-y-6">
                {existing && (
                  <Alert tone="ok">
                    You already have a page.{" "}
                    <Link href={`/app/c/${existing.creator.slug}`} className="underline font-semibold">View it</Link> or edit it below.
                  </Alert>
                )}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="name" className={label}>Your name</label>
                    <input id="name" className={field} maxLength={LIMITS.name} value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="Amani Draws" />
                  </div>
                  <div>
                    <label htmlFor="craft" className={label}>What you make</label>
                    <input id="craft" className={field} maxLength={LIMITS.craft} value={draft.craft} onChange={(e) => set({ craft: e.target.value })} placeholder="Comics about Nairobi life" />
                  </div>
                </div>
                <div>
                  <label htmlFor="bio" className={label}>About you <span className="font-normal text-ink-3">(optional)</span></label>
                  <textarea id="bio" rows={3} className={field} maxLength={LIMITS.bio} value={draft.bio} onChange={(e) => set({ bio: e.target.value })} placeholder="A sentence or two your members will see first." />
                </div>
                <fieldset>
                  <legend className={label}>Display image <span className="font-normal text-ink-3">(optional)</span></legend>
                  <div className="flex flex-wrap items-center gap-4">
                    <Avatar creator={previewCreator} size="lg" />
                    <div className="flex flex-wrap items-center gap-2.5">
                      <label className={`${btn.secondarySm} ${uploading ? "pointer-events-none opacity-60" : ""}`}>
                        {uploading ? "Check your wallet…" : draft.img ? "Change image" : "Choose an image"}
                        <input type="file" accept="image/*" className="sr-only" disabled={uploading}
                          onChange={(e) => { void chooseImage(e.target.files?.[0]); e.target.value = ""; }} />
                      </label>
                      {draft.img && !uploading && (
                        <button type="button" onClick={() => setDraft((d) => { const rest = { ...d }; delete rest.img; return rest; })} className={btn.quiet}>
                          <IconX className="w-4 h-4" />Remove
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-ink-3">Used for your banner and profile picture. We crop it to a square, shrink it, and remove location details before uploading.</p>
                </fieldset>
                <fieldset>
                  <legend className={label}>Page colour</legend>
                  <div className="flex gap-2.5">
                    {HUES.map((h) => (
                      <button key={h} type="button" onClick={() => set({ hue: h })} aria-label={`Colour ${h}`} aria-pressed={draft.hue === h}
                        className={`w-9 h-9 rounded-full transition-transform hover:scale-110 ${draft.hue === h ? "ring-2 ring-offset-2 ring-ink" : ""}`} style={{ background: h }} />
                    ))}
                  </div>
                </fieldset>

                <fieldset className="space-y-4">
                  <legend className="text-xl font-semibold mb-1">Membership tiers</legend>
                  {draft.tiers.map((t, i) => (
                    <div key={i} className="rounded-3xl border border-line p-5 space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mono text-xs tracking-[0.14em] uppercase text-ink-3">Tier {i + 1}</span>
                        {draft.tiers.length > 1 && (
                          <button type="button" onClick={() => set({ tiers: draft.tiers.filter((_, k) => k !== i) })} className={btn.quiet}><IconX className="w-4 h-4" />Remove</button>
                        )}
                      </div>
                      <div className="grid sm:grid-cols-[1.3fr_1fr_1fr] gap-3">
                        <div>
                          <label htmlFor={`tn${i}`} className={label}>Name</label>
                          <input id={`tn${i}`} className={field} maxLength={LIMITS.tierName} value={t.name} onChange={(e) => setTier(i, { name: e.target.value })} />
                        </div>
                        <div>
                          <label htmlFor={`tp${i}`} className={label}>Price (CKB)</label>
                          <input id={`tp${i}`} type="number" inputMode="numeric" min={LIMITS.minCkb} max={LIMITS.maxCkb} className={`${field} tnum`} value={t.ckb}
                            onChange={(e) => setTier(i, { ckb: Number(e.target.value) })} />
                        </div>
                        <div>
                          <label htmlFor={`te${i}`} className={label}>How often</label>
                          <select id={`te${i}`} className={field} value={t.every} onChange={(e) => setTier(i, { every: e.target.value as Period })}>
                            {Object.entries(PERIODS).map(([k, v]) => <option key={k} value={k}>{v.label.replace("every ", "Every ")}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <span className={label}>What members get</span>
                        {Array.from({ length: LIMITS.perks }, (_, k) => (
                          <input key={k} aria-label={`Perk ${k + 1}`} className={field} maxLength={LIMITS.perk} value={t.perks[k] ?? ""} placeholder={k === 0 ? "e.g. A new comic every week" : "Another perk (optional)"}
                            onChange={(e) => { const perks = [...t.perks]; perks[k] = e.target.value; setTier(i, { perks }); }} />
                        ))}
                      </div>
                    </div>
                  ))}
                  {draft.tiers.length < LIMITS.tiers && (
                    <button type="button" onClick={() => set({ tiers: [...draft.tiers, { name: "", ckb: 200, every: "week", perks: [""] }] })} className={btn.secondary}>Add a tier</button>
                  )}
                </fieldset>

                {!check.ok && draft.name && <p className="text-sm text-amber">{check.msg}</p>}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button type="submit" disabled={!check.ok || !!busy} className={btn.primaryLg}>
                    {busy === "publish" ? "Confirm in your wallet…" : existing ? "Save changes" : "Publish my page"} <IconArrowRight className="arrow w-4 h-4" />
                  </button>
                  {existing && (confirmRemove ? (
                    <>
                      <button type="button" onClick={() => void remove()} disabled={!!busy} className={btn.danger}>Yes, remove my page</button>
                      <button type="button" onClick={() => setConfirmRemove(false)} className={btn.quiet}>Keep it</button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setConfirmRemove(true)} disabled={!!busy} className={btn.secondary}>
                      {busy === "remove" ? "Confirm in your wallet…" : "Remove page"}
                    </button>
                  ))}
                </div>
                <p className="text-sm text-ink-3 leading-relaxed">
                  {deposit !== null ? <>Saving your page holds a refundable <strong className="text-ink-2 tnum">{formatCkb(deposit)} CKB</strong> deposit (about 1 CKB per character), returned if you remove it. </> : null}
                  Existing memberships keep their original price even if you change your tiers.
                </p>
              </form>

              {/* Live preview */}
              <aside aria-label="Preview" className="lg:sticky lg:top-24">
                <p className="font-mono text-[11px] tracking-[0.14em] uppercase text-ink-3 mb-3">Preview</p>
                <div className="rounded-3xl border border-line overflow-hidden bg-white">
                  <Cover creator={previewCreator} className="h-28" />
                  <div className="px-5 pb-6 -mt-10">
                    <Avatar creator={previewCreator} size="lg" ring />
                    <h2 className="mt-3 text-2xl font-semibold">{previewCreator.name}</h2>
                    <p className="text-ink-2">{previewCreator.craft}</p>
                    {draft.bio && <p className="mt-3 text-[15px] text-ink-2 leading-relaxed">{draft.bio}</p>}
                    <ul className="mt-5 space-y-3">
                      {draft.tiers.map((t, i) => (
                        <li key={i} className="rounded-2xl bg-soft px-4 py-3">
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="font-semibold">{t.name || "Tier name"}</span>
                            <span className="tnum text-sm"><strong>{Number.isFinite(t.ckb) ? t.ckb : 0} CKB</strong> <span className="text-ink-3">{PERIODS[t.every].label}</span></span>
                          </div>
                          {t.perks.filter(Boolean).length > 0 && (
                            <ul className="mt-1.5 text-sm text-ink-2 list-disc pl-5">{t.perks.filter(Boolean).map((p, k) => <li key={k}>{p}</li>)}</ul>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </aside>
            </div>
          )}
        </div>
      </main>
      <div className="mt-24"><Footer /></div>
    </>
  );
}
