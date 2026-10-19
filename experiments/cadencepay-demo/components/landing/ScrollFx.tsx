"use client";
import { useScrollProgress } from "./useScrollProgress";

/**
 * Wraps a block so CSS inside it can read scroll progress as `var(--p)`.
 * Lets server-rendered pages use the same scroll effects as the landing page.
 */
export function ScrollFx({ mode = "pass", className, style, children, as = "div", ...rest }: {
  mode?: "pass" | "pin";
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  as?: "div" | "section" | "ul";
} & React.AriaAttributes & { id?: string }) {
  const ref = useScrollProgress<HTMLElement>(mode);
  const Tag = as as "div";
  return <Tag ref={ref as React.Ref<HTMLDivElement>} className={className} style={style} {...rest}>{children}</Tag>;
}
