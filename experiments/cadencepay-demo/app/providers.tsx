"use client";
import dynamic from "next/dynamic";

// The CCC connector is a Lit web component. If React hydrates it before the
// custom element is defined, React 19 can only set `client` as an attribute,
// the component never receives the Client object, and its wallet refresh
// crashes on `client.addressPrefix`. Loading the provider client-side only
// guarantees the element is defined before React creates it.
const CccProvider = dynamic(() => import("./ccc-provider").then((m) => m.CccProvider), {
  ssr: false,
});

export function Providers({ children }: { children: React.ReactNode }) {
  return <CccProvider>{children}</CccProvider>;
}
