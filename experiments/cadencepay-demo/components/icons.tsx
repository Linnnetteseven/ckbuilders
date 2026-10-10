/** One consistent icon set: 24px grid, 1.75 stroke, round caps. */
type P = { className?: string; title?: string };

function Svg({ className = "w-4 h-4", title, children }: P & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export const IconLock = (p: P) => (
  <Svg {...p}><rect x="5" y="10.5" width="14" height="9.5" rx="2.5" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></Svg>
);
export const IconCheck = (p: P) => <Svg {...p}><path d="M5 12.5l4.2 4.2L19 7" /></Svg>;
export const IconX = (p: P) => <Svg {...p}><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" /></Svg>;
export const IconArrowRight = (p: P) => <Svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>;
export const IconArrowLeft = (p: P) => <Svg {...p}><path d="M19 12H5M11 6l-6 6 6 6" /></Svg>;
export const IconExternal = (p: P) => <Svg {...p}><path d="M14 5h5v5M19 5l-8 8M18 14v4a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18V7.5A1.5 1.5 0 0 1 5.5 6H10" /></Svg>;
export const IconRefresh = (p: P) => <Svg {...p}><path d="M20 12a8 8 0 1 1-2.35-5.65M20 4v4.5h-4.5" /></Svg>;
export const IconBook = (p: P) => (
  <Svg {...p}><path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z" /><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3M9 7.5h6" /></Svg>
);
export const IconStamp = (p: P) => (
  <Svg {...p}><path d="M9.5 3.5h5l-1 7h-3z" /><path d="M5 13.5h14v3.5H5zM6.5 20.5h11" /></Svg>
);
export const IconWallet = (p: P) => (
  <Svg {...p}><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11V8" /><rect x="4" y="8" width="16" height="11" rx="2.5" /><path d="M16 13.5h1.5" /></Svg>
);
export const IconSpark = (p: P) => <Svg {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18" /></Svg>;
