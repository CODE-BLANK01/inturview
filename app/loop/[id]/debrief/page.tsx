import { LoopDetail } from "@/components/loop/LoopDetail";
export const metadata = {
  title: "Loop debrief — inturview",
  robots: { index: false, follow: false },
};
export default function Page({ params }: { params: { id: string } }) {
  return <LoopDetail id={params.id} debrief />;
}
