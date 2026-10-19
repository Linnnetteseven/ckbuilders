/**
 * Hand-drawn capsule scenes, one per moment of a capsule's life, in the
 * landing page's ink-on-paper style:
 *   open    – the lid is off and a letter, a photo and a film go in (sealing)
 *   sealed  – closed, with a red wax seal pressed on (just sealed)
 *   buried  – under the soil strata, waiting (sealed, counting down)
 *   ready   – unearthed and glowing (it's time to open)
 *   opened  – lid open, CKB coins rising out (opened)
 * Decorative: always aria-hidden; the page text says what the picture shows.
 */
type Variant = "open" | "sealed" | "buried" | "ready" | "opened";

const ink = { stroke: "var(--color-ink)", strokeWidth: 2.5, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

function Capsule({ x, y, open = false, glow = false }: { x: number; y: number; open?: boolean; glow?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {glow && <ellipse cx="0" cy="0" rx="96" ry="52" fill="var(--color-brass)" opacity=".28" className="art-glow" />}
      <rect x="-70" y="-28" width="140" height="56" rx="28" fill="#D9A93B" {...ink} />
      <path d="M-46 -28 v56 M-38 -28 v56" {...ink} strokeWidth={1.6} fill="none" />
      {open ? (
        <g transform="translate(46 -30) rotate(-28)">
          <rect x="0" y="-26" width="44" height="52" rx="22" fill="#E6C06A" {...ink} />
        </g>
      ) : (
        <>
          <path d="M38 -28 v56" {...ink} fill="none" />
          <circle cx="55" cy="0" r="13" fill="var(--color-tomato)" {...ink} strokeWidth={2} className="art-seal" />
          <text x="55" y="5" textAnchor="middle" fontFamily="var(--font-slab)" fontSize="13" fill="var(--color-paper-2)">C</text>
        </>
      )}
    </g>
  );
}

function Cloud({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return <path transform={`translate(${x} ${y}) scale(${s})`} fill="#FFFDF6" {...ink} strokeWidth={2} d="M0 26 C-4 12 12 4 21 11 C25 -2 50 -4 55 12 C69 5 83 15 78 26 Z" />;
}

export function CapsuleArt({ variant, className = "" }: { variant: Variant; className?: string }) {
  const sky = variant === "buried" ? "#BFD3C9" : "#E6E2C8";
  return (
    <svg viewBox="0 0 320 220" className={className} aria-hidden>
      <rect width="320" height="220" rx="18" fill={sky} />
      <Cloud x={24} y={24} s={0.9} />
      <Cloud x={220} y={40} s={0.75} />
      {variant === "buried" ? (
        <>
          {/* ground and strata, the capsule below with a dotted dig line to the X */}
          <path d="M0 92 C80 80 160 100 320 86 V220 H0 Z" fill="#B7A267" {...ink} />
          <path d="M0 130 C90 120 200 140 320 126" stroke="rgba(30,27,22,.35)" strokeWidth="2" strokeDasharray="8 7" fill="none" />
          <path d="M0 172 C110 162 210 182 320 168" stroke="rgba(30,27,22,.3)" strokeWidth="2" strokeDasharray="3 7" fill="none" />
          <path d="M160 96 V150" stroke="var(--color-tomato)" strokeWidth="2.5" strokeDasharray="2 7" />
          <path d="M150 74 l20 20 M170 74 l-20 20" stroke="var(--color-tomato)" strokeWidth="6" strokeLinecap="round" />
          <g transform="scale(.82) translate(35 50)"><Capsule x={160} y={190} /></g>
        </>
      ) : (
        <>
          <path d="M0 168 C80 156 200 176 320 160 V220 H0 Z" fill="#9FB07A" {...ink} />
          {variant === "open" && (
            <>
              {/* letter, photo and film dropping in */}
              <g className="art-drop" style={{ animationDelay: "0ms" }}><rect x="112" y="40" width="44" height="30" rx="2" fill="#FFFDF6" {...ink} /><path d="M112 40 l22 16 l22 -16" {...ink} fill="none" /></g>
              <g className="art-drop" style={{ animationDelay: "160ms" }}><rect x="166" y="30" width="34" height="38" rx="2" fill="#FFFDF6" {...ink} /><path d="M170 60 l8 -9 l6 5 l5 -4 l7 8" {...ink} fill="none" strokeWidth={1.6} /></g>
              <g className="art-drop" style={{ animationDelay: "320ms" }}><rect x="210" y="52" width="36" height="26" rx="2" fill="#FFFDF6" {...ink} /><path d="M210 58 h36 M210 72 h36" {...ink} strokeWidth={1.5} /></g>
              <Capsule x={160} y={128} open />
            </>
          )}
          {variant === "sealed" && <Capsule x={160} y={124} />}
          {variant === "ready" && (
            <>
              <path d="M90 168 C110 150 210 150 230 168" fill="#B7A267" {...ink} />
              <Capsule x={160} y={118} glow />
              <path d="M70 78 l8 -12 M250 78 l-8 -12 M160 52 v-14" stroke="var(--color-brass)" strokeWidth="4" strokeLinecap="round" />
            </>
          )}
          {variant === "opened" && (
            <>
              {[0, 1, 2, 3].map((i) => (
                <g key={i} className="art-coin" style={{ animationDelay: `${i * 180}ms` }}>
                  <ellipse cx={128 + i * 22} cy={78 - (i % 2) * 14} rx="11" ry="11" fill="#F2C35B" {...ink} strokeWidth={2} />
                  <text x={128 + i * 22} y={82 - (i % 2) * 14} textAnchor="middle" fontFamily="var(--font-slab)" fontSize="10">C</text>
                </g>
              ))}
              <Capsule x={160} y={130} open />
            </>
          )}
        </>
      )}
    </svg>
  );
}
