"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ccc } from "@ckb-ccc/core";
import { useWallet } from "@/lib/useWallet";
import { friendlyTxError } from "@/lib/txErrors";
import { buildSealTx, packCapsule, randomBytes, secretsToFragment, seedToFragment, KEY_CELL_CAPACITY, type Media } from "@/lib/capsule";
import { deriveFromPhrase, generatePhrase, normalisePhrase, phraseLooksStrong } from "@/lib/secretWord";
import { blurredThumb, photoForCell, uploadRecording } from "@/lib/media";
import { Recorder } from "@/components/Recorder";
import { CameraSnap } from "@/components/CameraSnap";
import { Countdown } from "@/components/Countdown";
import { CapsuleArt } from "@/components/CapsuleArt";
import { AppFooter, AppNav, PageTitle, RouteSteps, StepCard } from "@/components/Shell";

type Who = "link" | "address" | "me";
const CKB = 100_000_000n;
const WINDOWS: [string, number][] = [
  ["10 minutes (for testing)", 600], ["30 days", 30 * 86400], ["90 days", 90 * 86400], ["6 months", 182 * 86400], ["1 year", 365 * 86400],
];

// Kept outside the component: the React compiler treats clock reads in render as impure
const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
const inMinutes = (m: number) => toLocalInput(new Date(Number(new Date()) + m * 60_000));
const nowMs = () => Number(new Date());

/** Quick choices count from the moment you seal, so recording a video can't eat a 10-minute test window */
const OPENS: [string, number][] = [["10 minutes (test)", 10], ["1 hour", 60], ["Tomorrow", 24 * 60], ["In a week", 7 * 24 * 60]];
type Opens = number | "pick" | null;
const unlockMsFor = (opens: Opens, picked: string, at = nowMs()) =>
  typeof opens === "number" ? at + opens * 60_000 : opens === "pick" ? new Date(picked).getTime() : NaN;
function describeOpens(ms: number, at: number) {
  if (!Number.isFinite(ms)) return "";
  const when = new Date(ms).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const mins = Math.round((ms - at) / 60_000);
  const rel = mins < 60 ? `${mins} minute${mins === 1 ? "" : "s"}` : mins < 48 * 60 ? `${Math.floor(mins / 60)} h ${mins % 60} min` : `${Math.round(mins / 1440)} days`;
  return mins <= 0 ? `${when} · already past` : `${when} · in ${rel}`;
}

const field = "w-full rounded-2xl border border-line bg-paper-2 px-4 py-3 outline-none focus:border-tomato";
const label = "block text-sm font-semibold mb-1.5";

export default function Seal() {
  const { signer, client, address, lock, connect } = useWallet();
  const [mode, setMode] = useState<"gift" | "legacy">("gift");
  const [who, setWho] = useState<Who>("link");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [occasion, setOccasion] = useState("");
  const [letter, setLetter] = useState("");
  const [photo, setPhoto] = useState<{ cell: Uint8Array; thumb: Uint8Array; url: string } | null>(null);
  const [showThumb, setShowThumb] = useState(true);
  const [camera, setCamera] = useState(false);
  const [useWord, setUseWord] = useState(true);
  const [phrase, setPhrase] = useState("");
  const [recKind, setRecKind] = useState<"video" | "voice">("video");
  const [recording, setRecording] = useState<Blob>();
  const [opens, setOpens] = useState<Opens>(null);
  const [unlock, setUnlock] = useState(() => inMinutes(24 * 60));
  // Ticks the "opens in …" line
  const [clock, setClock] = useState(0);
  useEffect(() => {
    const tick = () => setClock(nowMs());
    tick();
    const t = setInterval(tick, 20_000);
    return () => clearInterval(t);
  }, []);
  const [windowSecs, setWindowSecs] = useState(WINDOWS[3][1]);
  const [recipientAddr, setRecipientAddr] = useState("");
  const [gift, setGift] = useState(100);
  const [step, setStep] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ link: string; txHash: string; phrase?: string; opensAt?: number } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url); }, [photo]);
  // A fresh phrase on first load (after mount, so server and browser render the same)
  useEffect(() => { const t = setTimeout(() => setPhrase((p) => p || generatePhrase()), 0); return () => clearTimeout(t); }, []);

  const choosePhoto = async (f?: Blob) => {
    if (!f) return;
    setError("");
    try {
      const [cell, thumb] = await Promise.all([photoForCell(f), blurredThumb(f)]);
      setPhoto({ cell, thumb, url: URL.createObjectURL(new Blob([cell as BlobPart], { type: "image/webp" })) });
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't use that photo"); }
  };

  // Rough size of what goes in the cell (exact figure comes from the real data at sealing)
  const storageCkb = useMemo(() => {
    const bytes = 260 + new TextEncoder().encode(letter + from + to + occasion).length + (photo?.cell.length ?? 0)
      + (photo && showThumb ? photo.thumb.length : 0) + (recording ? 190 : 0);
    return bytes + 114;
  }, [letter, from, to, occasion, photo, showThumb, recording]);
  const keyCell = who === "link" ? 61 : 0;
  const total = storageCkb + keyCell + (Number.isFinite(gift) ? gift : 0);

  const problem = !from.trim() ? "Add who it's from"
    : !letter.trim() && !photo && !recording ? "Add a letter, a photo or a recording"
    : who === "address" && !/^ck[bt]1[0-9a-z]{20,}$/.test(recipientAddr.trim()) ? "Paste their CKB address"
    : mode === "gift" && opens === null ? "Choose when it opens"
    : mode === "gift" && opens === "pick" && !(new Date(unlock).getTime() > nowMs() + 60_000) ? "Pick an opening time in the future"
    : who === "link" && useWord && !phraseLooksStrong(phrase) ? "Use at least four words for the secret word"
    : !(gift >= 0) ? "Gift amount can't be negative" : "";

  const seal = async () => {
    if (!signer || !address || !lock || problem) return;
    setError(""); setResult(null);
    try {
      // With a secret word, the keys come from the link's seed plus the phrase; otherwise they're random
      let key: Uint8Array = randomBytes(32);
      let fixedGiftKey: Uint8Array | undefined;
      let seed: Uint8Array | undefined;
      if (who === "link" && useWord) {
        setStep("Locking it with your secret word…");
        seed = randomBytes(32);
        const derived = await deriveFromPhrase(seed, phrase);
        key = derived.key;
        fixedGiftKey = derived.giftKey;
      }
      let media: Media[] = [];
      if (recording) {
        setStep("Encrypting your recording… (your wallet will ask you to sign)");
        media = [await uploadRecording(recKind, recording, key, signer, address)];
      }
      const t = mode === "gift" ? BigInt(Math.floor(unlockMsFor(opens, unlock) / 1000)) : BigInt(windowSecs);
      setStep("Sealing your message…");
      const data = await packCapsule(key, mode === "gift" ? t : 0n, {
        from: from.trim(), to: to.trim(), occasion: occasion.trim(), letter: letter.trim(),
        photo: photo?.cell, thumb: photo && showThumb ? photo.thumb : undefined, media,
      });
      const recipientLock = who === "me" ? lock : who === "address" ? (await ccc.Address.fromString(recipientAddr.trim(), client)).script : undefined;
      const { tx, giftKey } = await buildSealTx({ sender: signer, mode, recipientLock, t, data, giftCapacity: BigInt(Math.floor(gift)) * CKB, giftKey: fixedGiftKey });
      setStep("Confirm in your wallet…");
      const txHash = await signer.sendTransaction(tx);
      const fragment = seed ? seedToFragment(seed) : secretsToFragment({ key, giftKey });
      const link = `${window.location.origin}/c/${txHash}-0#${fragment}`;
      setResult({ link, txHash, phrase: seed ? normalisePhrase(phrase) : undefined, opensAt: mode === "gift" ? Number(t) : undefined });
      setStep("");
    } catch (e) {
      setStep("");
      setError(friendlyTxError(e));
    }
  };

  if (result) {
    const share = `${to ? `${to}, ` : ""}I sealed a message for you${mode === "gift" ? "" : " for the future"}. Open it here: ${result.link}`;
    const opensText = result.opensAt ? new Date(result.opensAt * 1000).toLocaleString(undefined, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : null;
    return (
      <>
        <AppNav />
        <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 grid lg:grid-cols-[1.1fr_1fr] gap-10 items-start">
          <div className="space-y-8">
            <PageTitle kicker="see you on the day" title="Sealed.">
              Your capsule is on the network{to ? ` for ${to}` : ""}. Nothing more to pay or do, except send it.
            </PageTitle>
            <RouteSteps steps={[
              {
                title: "Copy the link",
                body: (
                  <div className="space-y-3 mt-2">
                    <div className="card relative p-3 font-mono text-xs break-all">{result.link}</div>
                    <div className="flex flex-wrap gap-2">
                      <button className="btn" onClick={() => { void navigator.clipboard.writeText(result.link).then(() => setCopied(true)); }}>{copied ? "Copied ✓" : "Copy link"}</button>
                      <a className="btn btn-ghost" href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noreferrer">Send on WhatsApp</a>
                    </div>
                    <p className="text-sm">It&apos;s the only key{result.phrase ? " (with the secret word)" : ""}. We can&apos;t recover it, so keep a copy yourself too.</p>
                  </div>
                ),
              },
              ...(result.phrase ? [{
                title: "Tell them the secret word, separately",
                body: (
                  <div className="space-y-2 mt-2">
                    <p className="slab text-2xl sm:text-3xl text-ink break-words">{result.phrase}</p>
                    <p className="text-sm">Say it on a call or in person, not in the same chat as the link. The link without these words opens nothing.</p>
                  </div>
                ),
              }] : []),
              {
                title: mode === "gift" ? "They open it on the day" : "It waits for as long as you check in",
                body: mode === "gift"
                  ? <p>{opensText ? `On ${opensText}` : "On the day"}, the link shows an Open button. Opening it reveals your message and sends every CKB inside to their wallet.</p>
                  : <p>Check in from My capsules now and then. If you stop, it opens for them after the time you chose.</p>,
              },
            ]} />
            <div className="flex flex-wrap gap-3">
              <Link className="btn btn-ghost" href={result.link.replace(window.location.origin, "")}>See what they&apos;ll see</Link>
              <Link className="btn btn-ghost" href="/mine">My capsules</Link>
            </div>
            <p className="text-sm text-ink-2">Receipt: <a className="underline" href={`https://testnet.explorer.nervos.org/transaction/${result.txHash}`} target="_blank" rel="noreferrer">{result.txHash.slice(0, 18)}…</a></p>
          </div>
          <aside className="card relative p-4 space-y-4 lg:sticky lg:top-24">
            <CapsuleArt variant={mode === "gift" ? "buried" : "sealed"} className="w-full rounded-xl" />
            {result.opensAt && <Countdown to={result.opensAt} label="Opens in" />}
          </aside>
        </main>
        <AppFooter />
      </>
    );
  }

  // Each step ticks itself off as it's completed
  const done = {
    message: !!from.trim() && (!!letter.trim() || !!photo || !!recording),
    who: who === "link" ? (!useWord || phraseLooksStrong(phrase)) : who === "address" ? /^ck[bt]1[0-9a-z]{20,}$/.test(recipientAddr.trim()) : true,
    when: mode === "legacy" || opens !== null,
  };
  const opensLine = mode === "gift" && opens !== null && clock > 0 ? describeOpens(unlockMsFor(opens, unlock, clock), clock) : null;

  return (
    <>
      <AppNav />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-4">
        <div className="grid lg:grid-cols-[1fr_auto] gap-8 items-end">
          <PageTitle kicker="write something they'll keep" title="Seal a message">
            Five short steps, then one tap in your wallet to seal it. You get a link to send.
            Nothing is sent to anyone until you share that link.
          </PageTitle>
          <CapsuleArt variant="open" className="lg:hidden w-full max-w-xs rounded-2xl border-2 border-ink" />
        </div>

        <div className="mt-10 grid lg:grid-cols-[1fr_20rem] gap-8 items-start">
          <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); void seal(); }}>
            <StepCard n={1} title="What kind?" hint="a gift, or for later" done>
          <div className="grid sm:grid-cols-2 gap-3">
            {([["gift", "A gift", "Opens on a date you choose."], ["legacy", "For if I'm gone", "Opens only if you stop checking in for a while."]] as const).map(([m, t, d]) => (
              <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}
                className={`text-left rounded-2xl border p-4 ${mode === m ? "border-ink bg-paper-2" : "border-line"}`}>
                <div className="font-semibold">{t}</div><div className="text-sm text-ink-2">{d}</div>
              </button>
            ))}
          </div>
            </StepCard>

            <StepCard n={2} title="Your message" hint="the part they'll keep" done={done.message}>
          <div className="grid sm:grid-cols-3 gap-3">
            <div><label className={label} htmlFor="from">From</label><input id="from" className={field} maxLength={60} value={from} onChange={(e) => setFrom(e.target.value)} placeholder="Mum" /></div>
            <div><label className={label} htmlFor="to">To</label><input id="to" className={field} maxLength={60} value={to} onChange={(e) => setTo(e.target.value)} placeholder="Amani" /></div>
            <div><label className={label} htmlFor="occ">Occasion</label><input id="occ" className={field} maxLength={60} value={occasion} onChange={(e) => setOccasion(e.target.value)} placeholder="18th birthday" /></div>
          </div>
          <div>
            <label className={label} htmlFor="letter">Letter</label>
            <textarea id="letter" rows={6} maxLength={4000} className={field} value={letter} onChange={(e) => setLetter(e.target.value)} placeholder="Write something they'll keep." />
          </div>

          <div>
            <span className={label}>Photo</span>
            <div className="flex flex-wrap items-center gap-3">
              {photo && <img src={photo.url} alt="Your photo" className="w-24 h-24 rounded-2xl object-cover" />}
              <button type="button" className="btn btn-ghost" onClick={() => setCamera(true)}>{photo ? "Retake" : "Take a photo"}</button>
              <label className="btn btn-ghost cursor-pointer">
                {photo ? "Choose another" : "Choose a photo"}
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => { void choosePhoto(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
              {photo && <button type="button" className="text-sm underline" onClick={() => setPhoto(null)}>Remove</button>}
            </div>
            {camera && <div className="mt-3"><CameraSnap onPhoto={(b) => void choosePhoto(b)} onClose={() => setCamera(false)} /></div>}
            {photo && (
              <label className="mt-2 flex items-center gap-2 text-sm text-ink-2">
                <input type="checkbox" checked={showThumb} onChange={(e) => setShowThumb(e.target.checked)} />
                Show a blurred hint of the photo before it opens
              </label>
            )}
            <p className="mt-1 text-sm text-ink-2">The photo is stored inside the cell ({photo ? `${photo.cell.length.toLocaleString()} bytes` : "about 20–40 KB"}), and every byte locks 1 CKB. They receive all of it when they open it.</p>
          </div>

          <div>
            <div className="flex gap-2 mb-2">
              {(["video", "voice"] as const).map((k) => (
                <button key={k} type="button" aria-pressed={recKind === k} onClick={() => { setRecKind(k); setRecording(undefined); }}
                  className={`rounded-full px-3 py-1 text-sm ${recKind === k ? "bg-ink text-paper" : "border border-line"}`}>{k === "video" ? "Video" : "Voice note"}</button>
              ))}
            </div>
            <Recorder kind={recKind} value={recording} onDone={setRecording} onClear={() => setRecording(undefined)} />
          </div>
            </StepCard>

            <StepCard n={3} title={mode === "gift" ? "Who is it for?" : "Who should receive it?"} hint="only they can open it" done={done.who}>
          <div className="flex flex-wrap gap-2">
            {([["link", "Send as a link"], ["address", "Their wallet (safest)"], ...(mode === "gift" ? [["me", "Future me"]] : [])] as [Who, string][]).map(([w, t]) => (
              <button key={w} type="button" aria-pressed={who === w} onClick={() => setWho(w)}
                className={`rounded-full px-4 py-2 text-sm ${who === w ? "bg-ink text-paper" : "border border-line"}`}>{t}</button>
            ))}
          </div>
          {who === "link" && (
            <div className="space-y-3">
              <p className="text-sm text-ink-2">They don&apos;t need a wallet yet. They&apos;ll make one when they open it.</p>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1" checked={useWord} onChange={(e) => setUseWord(e.target.checked)} />
                <span><strong>Protect it with a secret word</strong> (recommended). The link alone won&apos;t open it or reveal the message; they&apos;ll also need these words, which you tell them separately.</span>
              </label>
              {useWord && (
                <div className="flex flex-wrap items-center gap-2">
                  <textarea rows={2} className={`${field} max-w-md font-mono resize-none`} value={phrase} onChange={(e) => setPhrase(e.target.value.replace(/\n/g, " "))} aria-label="Secret word" spellCheck={false} autoCapitalize="none" />
                  <button type="button" className="text-sm underline" onClick={() => setPhrase(generatePhrase())}>New words</button>
                </div>
              )}
              {!useWord && <p className="text-sm text-tomato">Without a secret word, anyone who sees the link can open it once it&apos;s time.</p>}
            </div>
          )}
          {who === "address" && <p className="text-sm text-ink-2">Only their wallet can ever open it, not even you. They can make one with JoyID in a minute.</p>}
          {who === "address" && <input className={field} value={recipientAddr} onChange={(e) => setRecipientAddr(e.target.value)} placeholder="ckt1…" aria-label="Recipient CKB address" />}
          {who === "me" && <p className="text-sm text-ink-2">Only this wallet can open it, on the date.</p>}
            </StepCard>

            <StepCard n={4} title={mode === "gift" ? "When does it open?" : "Open if I don't check in for…"} hint="the network keeps the date" done={done.when}>
          {mode === "gift" ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="When it opens">
                {[...OPENS, ["Pick a date…", "pick"] as [string, "pick"]].map(([label, v]) => (
                  <button key={label} type="button" role="radio" aria-checked={opens === v} onClick={() => setOpens(v)}
                    className={`rounded-full px-4 py-2 text-sm ${opens === v ? "bg-ink text-paper" : "border border-line bg-paper-2"}`}>{label}</button>
                ))}
              </div>
              {opens === "pick" && (
                <input type="datetime-local" className={`${field} max-w-xs`} value={unlock} onChange={(e) => setUnlock(e.target.value)} aria-label="Opening date and time" />
              )}
              {opens !== null && clock > 0 && (
                <p className="slab text-lg" aria-live="polite">Opens {describeOpens(unlockMsFor(opens, unlock, clock), clock)}</p>
              )}
              {typeof opens === "number" && <p className="text-sm text-ink-2">Counted from the moment you seal it.</p>}
            </div>
          ) : (
            <select className={`${field} max-w-xs`} value={windowSecs} onChange={(e) => setWindowSecs(Number(e.target.value))} aria-label="Inactivity window">
              {WINDOWS.map(([t, s]) => <option key={s} value={s}>{t}</option>)}
            </select>
          )}
          {mode === "legacy" && <p className="text-sm text-ink-2">You can take it back or check in any time from My capsules. Checking in restarts the clock.</p>}
            </StepCard>

            <StepCard n={5} title="Add CKB" hint="all of it goes to them" done>
          <input type="number" min={0} step={1} className={`${field} max-w-[12rem] tnum`} value={gift} onChange={(e) => setGift(Number(e.target.value))} aria-label="Gift in CKB" />
              <p className="text-sm text-ink-2">On top of your gift, storing the message itself locks some CKB (1 per byte). They receive that too.</p>
            </StepCard>

            <StepCard n={6} title="Check and seal" hint="one tap in your wallet">
          <dl className="rounded-2xl bg-paper-2 border border-line p-4 text-sm tnum space-y-1.5">
            <div className="flex justify-between"><dt>Message storage (goes to them)</dt><dd>≈ {storageCkb.toLocaleString()} CKB</dd></div>
            {keyCell > 0 && <div className="flex justify-between"><dt>Link key (goes to them)</dt><dd>{Number(KEY_CELL_CAPACITY / CKB)} CKB</dd></div>}
            <div className="flex justify-between"><dt>Your gift</dt><dd>{(Number.isFinite(gift) ? gift : 0).toLocaleString()} CKB</dd></div>
            {mode === "gift" && opens !== null && clock > 0 && (
              <div className="flex justify-between gap-3"><dt>Opens</dt><dd className="text-right">{describeOpens(unlockMsFor(opens, unlock, clock), clock)}</dd></div>
            )}
            <div className="flex justify-between font-semibold border-t border-line pt-1.5"><dt>Total, plus a tiny network fee</dt><dd>≈ {total.toLocaleString()} CKB</dd></div>
          </dl>
              {error && <p role="alert" className="text-tomato">{error}</p>}
              {step && <p aria-live="polite">{step}</p>}
              {!signer ? (
                <button type="button" className="btn" onClick={() => void connect()}>Connect a wallet to seal</button>
              ) : (
                <div className="space-y-2">
                  <button type="submit" className="btn" disabled={!!problem || !!step}>
                    {mode === "gift" && opens !== null && clock > 0 && !problem ? `Seal it · opens ${describeOpens(unlockMsFor(opens, unlock, clock), clock).split(" · ")[1]}` : "Seal it"}
                  </button>
                  {problem && <p className="text-sm text-ink-2">{problem}</p>}
                </div>
              )}
              <p className="text-sm text-ink-2">Your wallet asks you to confirm, and sealing takes about ten seconds. Then you get the link to send.</p>
            </StepCard>
          </form>

          {/* Live preview of the capsule, always in view on wide screens */}
          <aside aria-label="Your capsule so far" className="hidden lg:block lg:sticky lg:top-24 card relative p-4 space-y-3">
            <CapsuleArt variant={done.message && done.who && done.when ? "sealed" : "open"} className="w-full rounded-xl" />
            <p className="label text-tomato">Your capsule</p>
            <p className="slab text-xl leading-tight">{to ? `For ${to}` : "For someone"}{from ? <span className="block text-base text-ink-2 font-serif">from {from}</span> : null}</p>
            {occasion && <p className="hand text-xl text-tomato -rotate-1">{occasion}</p>}
            <ul className="text-sm space-y-1">
              {[["A letter", !!letter.trim()], ["A photo", !!photo], [recKind === "video" ? "A video" : "A voice note", !!recording]].map(([t, on]) => (
                <li key={String(t)} className={on ? "" : "text-ink-2/60"}>{on ? "✓" : "○"} {t}</li>
              ))}
            </ul>
            <p className="text-sm">{mode === "gift" ? (opensLine ? `Opens ${opensLine}` : "Opening time not chosen yet") : "Opens if you stop checking in"}</p>
            <p className="slab text-2xl tnum">≈ {total.toLocaleString()} <span className="text-base">CKB inside</span></p>
          </aside>
        </div>
      </main>
      <AppFooter />
    </>
  );
}
