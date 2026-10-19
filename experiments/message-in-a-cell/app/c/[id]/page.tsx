import { OpenView } from "./OpenView";

export const metadata = { title: "A sealed message" };

export default async function CapsulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OpenView id={id} />;
}
