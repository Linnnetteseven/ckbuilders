"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Alert, Footer, Receipt, Skeleton, btn } from "@/components/ui";
import { Avatar, Cover } from "@/components/Creator";
import { IconArrowRight, IconCheck, IconX } from "@/components/icons";
import { useWallet } from "@/lib/useWallet";
import { friendlyTxError } from "@/lib/txErrors";
import { sha256Hex, toSquareWebp } from "@/lib/imageResize";
import { formatCkb } from "@/lib/cadencepay";
import {
  HUES, LIMITS, PERIODS, buildProfileTx, buildRemoveProfileTx, findMyProfiles, imageUrl, profileDeposit, profileSlug, validateProfile,
  type Period, type Profile, type ProfileData, type ProfileTier,
} from "@/lib/profiles";
import type { ccc } from "@ckb-ccc/core";

const BLANK: ProfileData = {
  v: 1, name: "", craft: "", bio: "", hue: HUES[0],
  tiers: [{ name: "Supporter", ckb: 100, every: "week", perks: ["My thanks, and early access", ""] }],
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Upload the display image once the profile tx is out; the node may need a few seconds to see it. */
async function uploadImage(file: Blob, txHash: string): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    const form = new FormData();
    form.set("file", file, "image.webp");
    form.set("txHash", txHash);
    const res = await fetch("/api/upload", { method: "POST", body: form });
    if (res.ok) return;
    const d = (await res.json().catch(() => ({}))) as { error?: string };
    if (![409, 502].includes(res.status) || attempt >= 9) throw new Error(d.error ?? "Upload failed");
    await sleep(3000);
  }
}

/** Resolves once the tx is in a block (or after about 3 minutes, whichever is first). */
async function waitCommitted(client: ccc.Client, txHash: string): Promise<boolean> {
  for (let i = 0; i < 45; i++) {
    const res = await client.getTransaction(txHash).catch(() => undefined);
    if (res?.status === "committed") return true;
    await sleep(4000);
  }
  return false;
}

type Done = { slug: string; txHash: string; isNew: boolean; confirmed: boolean; photo: "" | "uploading" | "done" | "failed" };

const field = "w-full rounded-2xl border border-line bg-white px-4 py-3 text-[15px] outline-none transition-colors focus:border-pink";
const label = "block text-sm font-semibold mb-1.5";

export default function Start() {
  const { signer, client, lock, connect } = useWallet();
  const [mine, setMine] = useState<{ owner: string; profiles: Profile[] } | null>(null);
  const [draft, setDraft] = useState<ProfileData>(BLANK);
  const [busy, setBusy] = useState<"" | "publish" | "remove">("");
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<{ label: string; txHash: string } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [resizing, setResizing] = useState(false);
  // A newly chosen image: previewed locally, uploaded only after the page is published
  const [photo, setPhoto] = useState<{ file: Blob; sha: string; preview: string } | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [copied, setCopied] = useState(false);

  const owner = lock?.hash();
  const copies = mine && mine.owner === owner ? mine.profiles : undefined;
  const existing = copies ? copies[0] ?? null : undefined;

  // Load the connected wallet's profile (if any) and start editing from it
  useEffect(() => {
    if (!lock) return;
    const o = lock.hash();
    let cancelled = false;
    findMyProfiles(client, lock)
      .then((ps) => {
        if (cancelled) return;
        setMine({ owner: o, profiles: ps });
        const p = ps[0];
        if (p) setDraft({ ...p.data, tiers: p.data.tiers.map((t) => ({ ...t, perks: [...t.perks, ""].slice(0, LIMITS.perks) })) });
      })
      .catch(() => { if (!cancelled) setMine({ owner: o, profiles: [] }); });
    return () => { cancelled = true; };
  }, [client, lock, refresh]);

  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.preview); }, [photo]);

  const check = useMemo(() => {
    try { return { ok: validateProfile(draft), msg: "" }; } catch (e) { return { ok: null, msg: e instanceof Error ? e.message : "Check the form" }; }
  }, [draft]);

  const previewCreator = useMemo(() => ({
    slug: lock ? profileSlug(lock) : "preview", name: draft.name || "Your name", craft: draft.craft || "What you make",
    bio: draft.bio, initials: (draft.name.trim().split(" ").map((w) => w[0]).join("").slice(0, 2) || "YN").toUpperCase(),
    hue: draft.hue, payoutAddress: "", tiers: [], posts: [],
    image: photo || draft.img ? { src: photo?.preview ?? draft.img!, cover: "50% 40%", face: "50% 35%", zoom: 1.3 } : undefined,
  }), [draft, lock, photo]);

  // Shrink the photo here (no wallet needed); it's uploaded after publishing
  const chooseImage = async (file: File | undefined) => {
    if (!file) return;
    setResizing(true); setError("");
    try {
      const webp = await toSquareWebp(file);
      setPhoto({ file: webp, sha: await sha256Hex(webp), preview: URL.createObjectURL(webp) });
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "We couldn't read that image");
    } finally { setResizing(false); }
  };
  const removeImage = () => {
    setPhoto(null);
    setDraft((d) => { const rest = { ...d }; delete rest.img; return rest; });
  };

  const set = (patch: Partial<ProfileData>) => setDraft((d) => ({ ...d, ...patch }));
  const setTier = (i: number, patch: Partial<ProfileTier>) => setDraft((d) => ({ ...d, tiers: d.tiers.map((t, k) => (k === i ? { ...t, ...patch } : t)) }));

  // One wallet signature: the profile tx names the image's URL, and that tx authorises the upload
  const publish = async () => {
    if (!signer || !lock || !check.ok || !copies) return;
    setBusy("publish"); setError(""); setReceipt(null);
    try {
      const data = photo ? { ...check.ok, img: imageUrl(lock, photo.sha) } : check.ok;
      const txHash = await signer.sendTransaction(await buildProfileTx(signer, data, copies));
      const pending = photo;
      const base: Done = { slug: profileSlug(lock), txHash, isNew: !existing, confirmed: false, photo: pending ? "uploading" : "" };
      setDone(base);
      if (data.img) setDraft((d) => ({ ...d, img: data.img }));
      if (pending) {
        uploadImage(pending.file, txHash)
          .then(() => setDone((d) => (d?.txHash === txHash ? { ...d, photo: "done" } : d)))
          .catch(() => setDone((d) => (d?.txHash === txHash ? { ...d, photo: "failed" } : d)));
      }
      void waitCommitted(client, txHash).then((ok) => {
        setDone((d) => (d?.txHash === txHash ? { ...d, confirmed: ok } : d));
        setRefresh((n) => n + 1);
      });
    } catch (e) {
      setError(friendlyTxError(e));
    } finally { setBusy(""); }
  };

  const remove = async () => {
    if (!signer || !copies?.length) return;
    setBusy("remove"); setError(""); setConfirmRemove(false);
    try {
      const txHash = await signer.sendTransaction(await buildRemoveProfileTx(signer, copies));
      const back = copies.reduce((s, p) => s + p.cell.cellOutput.capacity, 0n);
      setReceipt({ label: `Page removed. ${formatCkb(back)} CKB is back in your wallet`, txHash });
      setDraft(BLANK); setPhoto(null);
      void waitCommitted(client, txHash).then(() => setRefresh((n) => n + 1));
    } catch (e) {
      setError(friendlyTxError(e));
    } finally { setBusy(""); }
  };

  const deposit = check.ok && lock ? profileDeposit(check.ok, lock) : null;
  const extra = copies && copies.length > 1 ? copies.slice(1).reduce((s, p) => s + p.cell.cellOutput.capacity, 0n) : 0n;
  const pageUrl = done ? `${typeof window === "undefined" ? "" : window.location.origin}/app/c/${done.slug}` : "";
  const copyLink = () => {
    void navigator.clipboard?.writeText(pageUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };

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
          ) : done ? (
            <section aria-live="polite" className="rise mt-8 max-w-2xl rounded-3xl bg-blush px-6 sm:px-10 py-10 sm:py-12">
              <span className="grid place-items-center w-14 h-14 rounded-full bg-forest text-white"><IconCheck className="w-7 h-7" /></span>
              <h2 className="mt-5 text-3xl sm:text-4xl font-semibold tracking-tight">{done.isNew ? "Your creator page is live" : "Your changes are saved"}</h2>
              <p className="mt-3 text-ink-2 flex items-center gap-2">
                {done.confirmed ? (
                  <><IconCheck className="w-4 h-4 text-forest shrink-0" />Confirmed on the network. Share the link and members can join.</>
                ) : (
                  <><span aria-hidden className="w-2.5 h-2.5 rounded-full bg-pink animate-pulse shrink-0" />Confirming on the network, usually under a minute. You can share the link now.</>
                )}
              </p>
              {done.photo === "uploading" && <p className="mt-1 text-sm text-ink-3">Uploading your display image…</p>}
              {done.photo === "failed" && <p className="mt-2 text-sm text-amber">Your page is saved, but the display image didn&apos;t upload. Edit your page, choose it again and save.</p>}

              <div className="mt-7">
                <span className={label}>Your page&apos;s link</span>
                <div className="flex items-center gap-2 rounded-2xl border border-line bg-white pl-4 pr-1.5 py-1.5">
                  <span className="font-mono text-sm truncate min-w-0 flex-1">{pageUrl}</span>
                  <button type="button" onClick={copyLink} className={btn.secondarySm}>{copied ? "Copied ✓" : "Copy"}</button>
                </div>
              </div>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                {done.confirmed ? (
                  <Link href={`/app/c/${done.slug}`} className={btn.primaryLg}>View my page <IconArrowRight className="arrow w-4 h-4" /></Link>
                ) : (
                  <span className={`${btn.primaryLg} opacity-60 pointer-events-none`} aria-disabled>View my page once confirmed…</span>
                )}
                <button type="button" onClick={() => { setDone(null); setPhoto(null); }} className={btn.secondary}>Edit my page</button>
              </div>
              <div className="mt-8"><Receipt label={done.isNew ? "Page published" : "Page updated"} txHash={done.txHash} /></div>
            </section>
          ) : existing === undefined ? (
            <div className="mt-8 grid lg:grid-cols-2 gap-8"><Skeleton className="h-96" /><Skeleton className="h-96" /></div>
          ) : (
            <div className="mt-8 grid lg:grid-cols-[1.1fr_1fr] gap-8 lg:gap-12 items-start">
              <form onSubmit={(e) => { e.preventDefault(); void publish(); }} className="space-y-6">
                {copies && copies.length > 1 && (
                  <Alert tone="warn">
                    Your page was published {copies.length} times, so {copies.length} copies are holding deposits. Saving merges them into one and returns {formatCkb(extra)} CKB to your wallet.
                  </Alert>
                )}
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
                      <label className={`${btn.secondarySm} ${resizing ? "pointer-events-none opacity-60" : ""}`}>
                        {resizing ? "Preparing…" : photo || draft.img ? "Change image" : "Choose an image"}
                        <input type="file" accept="image/*" className="sr-only" disabled={resizing}
                          onChange={(e) => { void chooseImage(e.target.files?.[0]); e.target.value = ""; }} />
                      </label>
                      {(photo || draft.img) && !resizing && (
                        <button type="button" onClick={removeImage} className={btn.quiet}>
                          <IconX className="w-4 h-4" />Remove
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-ink-3">Used for your banner and profile picture. We crop it to a square, shrink it, and remove location details. It uploads when you publish, with no extra wallet step.</p>
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
                    {busy === "publish" ? "Confirm in your wallet…" : existing ? (copies && copies.length > 1 ? "Save and merge" : "Save changes") : "Publish my page"} <IconArrowRight className="arrow w-4 h-4" />
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
                  You&apos;ll confirm once in your wallet. {deposit !== null ? <>Saving your page holds a refundable <strong className="text-ink-2 tnum">{formatCkb(deposit)} CKB</strong> deposit (about 1 CKB per character), returned if you remove it. </> : null}
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
