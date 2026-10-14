import Link from "next/link";

import { NavBar } from "@/components/NavBar";

type ParkedRouteNoticeProps = {
  title: string;
  description: string;
};

export function ParkedRouteNotice({ title, description }: ParkedRouteNoticeProps) {
  return (
    <div className="page-shell">
      <NavBar rightSlot={<Link href="/">Back home</Link>} />
      <main className="mx-auto flex min-h-[calc(100vh-65px)] max-w-2xl flex-col justify-center px-5 py-10">
        <div className="card p-6 sm:p-8">
          <div className="mb-5 inline-flex rounded-full bg-brand/7 px-3 py-1 text-[11.5px] font-semibold text-brand">
            Parked for now
          </div>
          <h1 className="text-[32px] font-bold tracking-[-0.04em]">{title}</h1>
          <p className="mt-2 text-sm leading-7 text-black/45">{description}</p>
          <Link
            href="/"
            className="mt-6 inline-flex rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white"
          >
            Start a new agent
          </Link>
        </div>
      </main>
    </div>
  );
}
