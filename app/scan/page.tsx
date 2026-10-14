import { NavBar } from "@/components/NavBar";
import { ScanRunner } from "@/components/ScanRunner";

export default function ScanPage({
  searchParams
}: {
  searchParams: { url?: string; job?: string };
}) {
  return (
    <div className="page-shell">
      <NavBar rightSlot={undefined} />
      <div className="flex min-h-[calc(100vh-65px)]">
        <ScanRunner url={searchParams.url ?? ""} initialJobId={searchParams.job ?? ""} />
      </div>
    </div>
  );
}
