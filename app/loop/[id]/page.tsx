import { LoopDetail } from "@/components/loop/LoopDetail";
export const metadata = {
  title: "Your interview loop — inturview",
  robots: { index: false, follow: false },
};
export default function Page({ params }: { params: { id: string } }) {
  return <LoopDetail id={params.id} />;
}
