import type { Metadata } from "next";
import { Landing } from "@/components/landing/Landing";

export const metadata: Metadata = {
  title: { absolute: "CadencePay: support your favourite creators, stay in control" },
  description:
    "Recurring payments on CKB where members keep control. Creators collect the agreed amount once each period; members can top up or cancel any time. Try the demo or read the docs.",
};

export default function Home() {
  return <Landing />;
}
