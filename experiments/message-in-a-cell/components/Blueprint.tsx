/**
 * Technical cross-section of a capsule (after Heron's self-drawing plans).
 * Each stroke has pathLength=1 and draws in as `--p` passes its own start
 * (`--s`, over `--l`); annotations fade in alongside. Reads `--p` from a parent.
 */
const D = (s: number, l = 0.12) => ({ "--s": s, "--l": l }) as React.CSSProperties;

function Note({ x, y, tx, ty, s, title, value, anchor = "start" }: {
  x: number; y: number; tx: number; ty: number; s: number; title: string; value: string; anchor?: "start" | "end";
}) {
  return (
    <g className="bp-note" style={D(s, 0.06)}>
      <path d={`M${x} ${y} L${tx} ${ty}`} className="bp-draw" pathLength={1} style={D(s, 0.06)} stroke="var(--color-tomato)" strokeWidth="1.2" fill="none" />
      <circle cx={x} cy={y} r="3.2" fill="var(--color-tomato)" />
      <text x={tx + (anchor === "start" ? 6 : -6)} y={ty - 4} textAnchor={anchor} className="bp-label">{title}</text>
      <text x={tx + (anchor === "start" ? 6 : -6)} y={ty + 12} textAnchor={anchor} className="bp-value">{value}</text>
    </g>
  );
}

export function Blueprint({ codeHash, block }: { codeHash: string; block: string }) {
  const ink = { stroke: "var(--color-ink)", strokeWidth: 1.6, fill: "none", vectorEffect: "non-scaling-stroke" as const };
  const thin = { ...ink, strokeWidth: 0.9 };
  return (
    <svg viewBox="0 0 640 520" className="w-full h-full" role="img" aria-label="Cross-section of a capsule: a letter, a photo and a video sealed with CKB under a wax seal">
      {/* construction grid */}
      <g className="bp-grid" style={D(0, 0.1)}>
        {Array.from({ length: 13 }, (_, i) => <line key={`v${i}`} x1={i * 50 + 20} y1="0" x2={i * 50 + 20} y2="520" stroke="rgba(30,27,22,.08)" />)}
        {Array.from({ length: 11 }, (_, i) => <line key={`h${i}`} x1="0" y1={i * 50 + 10} x2="640" y2={i * 50 + 10} stroke="rgba(30,27,22,.08)" />)}
        <line x1="0" y1="260" x2="640" y2="260" stroke="var(--color-tomato)" strokeWidth=".8" strokeDasharray="6 6" />
        <line x1="320" y1="0" x2="320" y2="520" stroke="var(--color-tomato)" strokeWidth=".8" strokeDasharray="6 6" />
      </g>

      {/* body: a capsule on its side */}
      <path className="bp-draw" pathLength={1} style={D(0.04, 0.16)} {...ink} strokeWidth={2.2}
        d="M190 170 H450 A90 90 0 0 1 450 350 H190 A90 90 0 0 1 190 170 Z" />
      <path className="bp-draw" pathLength={1} style={D(0.1, 0.12)} {...thin} d="M196 182 H444 A78 78 0 0 1 444 338 H196 A78 78 0 0 1 196 182 Z" />
      {/* lid seam and bands */}
      <path className="bp-draw" pathLength={1} style={D(0.16, 0.08)} {...ink} d="M410 170 V350" />
      <path className="bp-draw" pathLength={1} style={D(0.18, 0.08)} {...thin} d="M418 170 V350 M230 170 V350 M238 170 V350" />
      {/* hatched wall */}
      <g className="bp-draw-group" style={D(0.2, 0.1)}>
        {Array.from({ length: 14 }, (_, i) => <path key={i} className="bp-draw" pathLength={1} style={D(0.2 + i * 0.006, 0.05)} {...thin} d={`M${250 + i * 12} 170 l-8 12`} />)}
      </g>

      {/* contents */}
      {/* letter, folded */}
      <path className="bp-draw" pathLength={1} style={D(0.3, 0.1)} {...ink} d="M258 208 h92 v62 h-92 Z M258 208 l46 34 l46 -34" />
      {/* photo */}
      <path className="bp-draw" pathLength={1} style={D(0.36, 0.1)} {...ink} d="M262 284 h62 v48 h-62 Z M268 324 l14 -16 l10 10 l8 -8 l18 14" />
      <circle className="bp-draw" pathLength={1} style={D(0.38, 0.06)} cx="306" cy="296" r="4.5" {...thin} />
      {/* film strip */}
      <path className="bp-draw" pathLength={1} style={D(0.42, 0.1)} {...ink} d="M340 282 h58 v52 h-58 Z M340 290 h58 M340 326 h58" />
      <g className="bp-note" style={D(0.44, 0.06)}>{[346, 358, 370, 382].map((x) => <rect key={x} x={x} y="284" width="5" height="4" fill="var(--color-ink)" />)}</g>
      {/* coins */}
      {[0, 1, 2].map((i) => (
        <ellipse key={i} className="bp-draw" pathLength={1} style={D(0.48 + i * 0.03, 0.06)} cx="374" cy={252 - i * 9} rx="22" ry="7" {...ink} fill="var(--color-paper-2)" />
      ))}
      {/* wax seal on the lid */}
      <circle className="bp-draw" pathLength={1} style={D(0.56, 0.08)} cx="450" cy="260" r="26" {...ink} strokeWidth={2} />
      <circle className="bp-fill" style={D(0.6, 0.06)} cx="450" cy="260" r="21" fill="var(--color-tomato)" />
      <text className="bp-fill" style={D(0.62, 0.05)} x="450" y="266" textAnchor="middle" fontFamily="var(--font-slab)" fontSize="17" fill="var(--color-paper-2)">C</text>

      {/* dimension line */}
      <g className="bp-note" style={D(0.66, 0.06)}>
        <path d="M100 400 H540 M100 392 v16 M540 392 v16" stroke="var(--color-ink)" strokeWidth="1" />
        <text x="320" y="420" textAnchor="middle" className="bp-label">capacity = data bytes + gift, in CKB</text>
      </g>

      <Note s={0.7} x={304} y={226} tx={120} ty={90} title="Letter" value="AES-256 · key in your link" anchor="start" />
      <Note s={0.74} x={290} y={318} tx={70} ty={470} title="Photo" value="inside the cell · 1 CKB / byte" />
      <Note s={0.78} x={378} y={310} tx={600} ty={470} title="Video / voice" value="encrypted file · sha256 on-chain" anchor="end" />
      <Note s={0.82} x={374} y={236} tx={430} ty={70} title="CKB" value="all of it goes to them" />
      <Note s={0.86} x={466} y={244} tx={600} ty={150} title="Seal" value={`capsule-lock ${codeHash.slice(0, 10)}…`} anchor="end" />
      <g className="bp-note" style={D(0.9, 0.06)}>
        <text x="20" y="30" className="bp-label">Fig. 1, a capsule, sectioned</text>
        <text x="620" y="30" textAnchor="end" className="bp-label">testnet block {block}</text>
      </g>
    </svg>
  );
}
