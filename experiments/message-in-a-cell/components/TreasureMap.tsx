"use client";
import { useEffect, useRef, useState } from "react";
import { useScrollProgress } from "./useScrollProgress";

/**
 * "The road to opening day": a hand-drawn map (after ridetorio) pinned while
 * you scroll. The dotted route draws itself, a capsule travels along it, and a
 * chapter card follows the stops. Route progress lives in refs and CSS, so
 * scrolling never re-renders the map; only the chapter index is state.
 */
const STOPS = [
  { x: 110, y: 470, name: "Write", when: "Day 0 · your kitchen table", text: "Write a letter, take a photo, record thirty seconds of your voice. It's encrypted on your phone before it goes anywhere." },
  { x: 265, y: 360, name: "Seal", when: "Day 0 · one block", text: "Your wallet seals it into a cell with the CKB you add. The date goes into the lock, and nobody can change it, not even you." },
  { x: 410, y: 470, name: "Bury", when: "Day 1 · everywhere at once", text: "The capsule lives on CKB, copied by nodes all over the world. No company holds it and no server can lose it." },
  { x: 585, y: 300, name: "Wait", when: "Months, years", text: "Seasons pass. A new block about every 8 seconds, nearly four million a year. For a legacy capsule, you check in now and then." },
  { x: 745, y: 430, name: "Unearth", when: "The day", text: "The network's own clock reaches the date. The lock opens for one person: whoever holds your link, or the wallet it was sealed for." },
  { x: 885, y: 175, name: "Open", when: "X marks the day", text: "One tap opens it. The message plays, and every CKB inside lands in their wallet, including the CKB that stored your words." },
];
// A smooth path through the stops
const ROUTE = "M110 470 C170 430 200 370 265 360 S360 500 410 470 S520 300 585 300 S700 470 745 430 S860 260 885 175";
const R0 = 0.05, R1 = 0.9; // route draws between these scroll fractions

const ink = { stroke: "var(--color-ink)", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function Cloud({ x, y, s = 1, k }: { x: number; y: number; s?: number; k: number }) {
  return (
    <g className="map-cloud" style={{ "--k": k } as React.CSSProperties}>
      <path transform={`translate(${x} ${y}) scale(${s})`} fill="#FFFDF6" {...ink}
        d="M0 30 C-4 14 14 6 24 14 C28 -2 56 -4 62 14 C78 6 94 18 88 30 Z" />
    </g>
  );
}

export function TreasureMap() {
  const [step, setStep] = useState(0);
  const route = useRef<SVGPathElement>(null);
  const reveal = useRef<SVGPathElement>(null);
  const marker = useRef<SVGGElement>(null);
  const geo = useRef<{ total: number; at: number[] } | null>(null);
  const section = useRef<HTMLElement | null>(null);
  const svg = useRef<SVGSVGElement>(null);

  // Measure the route once: total length and where each stop sits along it
  useEffect(() => {
    const p = route.current;
    if (!p) return;
    const total = p.getTotalLength();
    const at = STOPS.map((s) => {
      let best = 0, bestD = Infinity;
      for (let l = 0; l <= total; l += total / 600) {
        const pt = p.getPointAtLength(l);
        const d = (pt.x - s.x) ** 2 + (pt.y - s.y) ** 2;
        if (d < bestD) { bestD = d; best = l; }
      }
      return best;
    });
    geo.current = { total, at };
    if (reveal.current) reveal.current.style.strokeDasharray = `${total} ${total}`;
  }, []);

  const ref = useScrollProgress<HTMLElement>("pin", (p) => {
    const g = geo.current;
    if (!g || !route.current || !reveal.current || !marker.current) return;
    const r = Math.min(1, Math.max(0, (p - R0) / (R1 - R0)));
    const dist = r * g.total;
    reveal.current.style.strokeDashoffset = String(g.total - dist);
    const pt = route.current.getPointAtLength(dist);
    marker.current.setAttribute("transform", `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
    // On narrow screens the map is wider than the viewport: pan to keep the capsule in view
    if (svg.current) {
      const vw = window.innerWidth, vh = window.innerHeight;
      const drawnW = Math.max(vw, (vh * 1000) / 620);
      const spare = (drawnW - vw) / 2;
      const pan = spare > 0 ? Math.max(-spare, Math.min(spare, drawnW / 2 - (pt.x / 1000) * drawnW)) : 0;
      svg.current.style.width = `${drawnW}px`;
      svg.current.style.left = `${((vw - drawnW) / 2).toFixed(1)}px`;
      svg.current.style.transform = `translateX(${pan.toFixed(1)}px)`;
    }
    let s = 0;
    g.at.forEach((l, i) => { if (dist >= l - 2) s = i; });
    setStep((cur) => (cur === s ? cur : s));
  });
  useEffect(() => { section.current = ref.current; });

  // Previous / Next jump the scroll to a stop
  const goTo = (i: number) => {
    const el = section.current, g = geo.current;
    if (!el || !g) return;
    const r = g.at[i] / g.total;
    const p = R0 + r * (R1 - R0) + 0.002;
    const top = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + p * (el.offsetHeight - window.innerHeight), behavior: "smooth" });
  };

  const s = STOPS[step];
  return (
    <section ref={ref} aria-labelledby="map-h" className="pin-track relative h-[600vh]">
      <div className="pin-sticky sticky top-0 h-dvh overflow-hidden bg-[#BFD3C9]">
        <h2 id="map-h" className="sr-only">The road to opening day</h2>
        <svg ref={svg} viewBox="0 0 1000 620" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full will-change-transform" aria-hidden>
          <defs>
            <pattern id="waves" width="40" height="18" patternUnits="userSpaceOnUse">
              <path d="M0 9 q10 -6 20 0 t20 0" stroke="rgba(30,27,22,.18)" fill="none" />
            </pattern>
            <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
              <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(30,27,22,.28)" strokeWidth="1.4" />
            </pattern>
            <mask id="route-reveal">
              <path ref={reveal} d={ROUTE} stroke="#fff" strokeWidth="14" fill="none" strokeLinecap="round" />
            </mask>
          </defs>
          {/* sea */}
          <rect width="1000" height="620" fill="#9DBFC0" />
          <rect width="1000" height="620" fill="url(#waves)" />
          {/* land */}
          <path d="M-20 560 C40 470 30 380 120 330 C200 290 210 210 300 200 C390 190 420 250 500 220 C600 180 640 90 760 90 C880 90 930 40 1020 60 L1020 640 L-20 640 Z"
            fill="#E9DDB4" {...ink} strokeWidth={2.5} />
          <path d="M60 560 C120 520 160 520 230 540 C320 565 420 520 520 540 C640 565 760 520 1020 560 L1020 640 L60 640 Z" fill="#B7BF7A" opacity=".8" />
          {/* hills and mountains */}
          {[[520, 250, 70], [640, 210, 90], [760, 250, 60], [330, 280, 55]].map(([x, y, w], i) => (
            <g key={i}>
              <path d={`M${x - w} ${y + 40} L${x} ${y - 30} L${x + w} ${y + 40} Z`} fill="#D9A93B" {...ink} />
              <path d={`M${x - w} ${y + 40} L${x} ${y - 30} L${x + w} ${y + 40} Z`} fill="url(#hatch)" />
              <path d={`M${x - 14} ${y - 10} L${x} ${y - 30} L${x + 12} ${y - 12}`} fill="#FFFDF6" {...ink} strokeWidth={1.5} />
            </g>
          ))}
          {/* forests */}
          {Array.from({ length: 26 }, (_, i) => {
            const x = 150 + ((i * 97) % 700), y = 380 + ((i * 53) % 150);
            return <circle key={i} cx={x} cy={y} r={7 + (i % 3) * 2} fill="#8C9A4A" {...ink} strokeWidth={1.4} />;
          })}
          {/* river */}
          <path d="M300 200 C330 280 300 330 360 380 S470 420 520 560" stroke="#5E8FB0" strokeWidth="7" fill="none" strokeLinecap="round" />
          {/* the route: faint whole path, then the drawn dotted part */}
          <path ref={route} d={ROUTE} stroke="rgba(30,27,22,.18)" strokeWidth="3" strokeDasharray="2 9" fill="none" strokeLinecap="round" />
          <path d={ROUTE} stroke="var(--color-tomato)" strokeWidth="5" strokeDasharray="2 11" fill="none" strokeLinecap="round" mask="url(#route-reveal)" />
          {/* stops */}
          {STOPS.map((st, i) => (
            <g key={st.name} transform={`translate(${st.x} ${st.y})`}>
              {i === STOPS.length - 1 ? (
                <path d="M-14 -14 L14 14 M14 -14 L-14 14" stroke="var(--color-tomato)" strokeWidth="6" strokeLinecap="round" />
              ) : (
                <circle r="9" fill={i <= step ? "var(--color-tomato)" : "#FFFDF6"} {...ink} />
              )}
              <text y={i === STOPS.length - 1 ? -24 : -16} textAnchor="middle" fontFamily="var(--font-slab)" fontSize="16" fill="var(--color-ink)" stroke="#F4EAD0" strokeWidth="4" paintOrder="stroke">{st.name}</text>
            </g>
          ))}
          {/* the travelling capsule */}
          <g ref={marker} transform={`translate(${STOPS[0].x} ${STOPS[0].y})`}>
            <g transform="translate(-22 -11)">
              <rect width="44" height="22" rx="11" fill="#D9A93B" {...ink} />
              <line x1="30" y1="0" x2="30" y2="22" {...ink} />
              <circle cx="37" cy="11" r="4" fill="var(--color-tomato)" />
            </g>
          </g>
          {/* clouds drift as time passes */}
          <Cloud x={160} y={90} k={1} s={1.1} />
          <Cloud x={430} y={60} k={-0.7} s={0.9} />
          <Cloud x={640} y={150} k={1.3} s={1.2} />
          <Cloud x={820} y={320} k={-1} />
          {/* compass */}
          <g transform="translate(70 90)">
            <circle r="34" fill="#FFFDF6" {...ink} />
            <path d="M0 -30 L7 0 L0 30 L-7 0 Z" fill="var(--color-ink)" />
            <path d="M0 -30 L7 0 L-7 0 Z" fill="var(--color-tomato)" />
            <text y="-40" textAnchor="middle" fontFamily="var(--font-slab)" fontSize="13">N</text>
          </g>
        </svg>

        {/* stop rail (like a country list) */}
        <ol className="hidden md:block absolute left-5 top-1/2 -translate-y-1/2 space-y-1.5 label text-ink" aria-hidden>
          {STOPS.map((st, i) => (
            <li key={st.name} className={`flex items-center gap-2 transition-opacity ${i === step ? "opacity-100" : "opacity-45"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${i === step ? "bg-tomato" : "bg-ink"}`} />{st.name}
            </li>
          ))}
        </ol>

        {/* chapter card */}
        <article aria-live="polite" className="card stamp absolute right-3 left-3 bottom-16 md:left-auto md:bottom-auto md:right-8 md:top-1/2 md:-translate-y-1/2 md:w-[22rem] p-5 md:p-6">
          <p className="label text-tomato">{String(step + 1).padStart(2, "0")} · {s.when}</p>
          <h3 key={step} className="slab text-3xl mt-1.5 chapter-in">{s.name}</h3>
          <p className="mt-2 text-[15.5px] leading-relaxed text-ink-2">{s.text}</p>
          <div className="mt-4 flex justify-between gap-3 relative z-10">
            <button type="button" className="btn btn-ghost !py-1.5 !px-3 !text-xs" disabled={step === 0} onClick={() => goTo(step - 1)}>← Previous</button>
            <button type="button" className="btn btn-ghost !py-1.5 !px-3 !text-xs" disabled={step === STOPS.length - 1} onClick={() => goTo(step + 1)}>Next →</button>
          </div>
        </article>

        {/* time strip (like an elevation profile) */}
        <div className="absolute left-0 right-0 bottom-0 h-12 bg-paper-2/90 border-t-2 border-ink flex items-center px-4 gap-4" aria-hidden>
          <span className="label">Sealed</span>
          <div className="relative flex-1 h-6">
            {Array.from({ length: 41 }, (_, i) => <span key={i} className="absolute bottom-0 w-px bg-ink/50" style={{ left: `${i * 2.5}%`, height: i % 5 ? 6 : 14 }} />)}
            <span className="map-needle absolute bottom-0 w-[3px] h-6 bg-tomato" />
          </div>
          <span className="label">Opened</span>
        </div>
      </div>
    </section>
  );
}
