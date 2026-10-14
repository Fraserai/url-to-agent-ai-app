import type { ReactNode } from "react";

import Link from "next/link";

type NavBarProps = {
  rightSlot?: ReactNode;
};

export function NavBar({ rightSlot }: NavBarProps) {
  return (
    <nav className="sticky top-0 z-50 border-b border-black/5 bg-[rgba(245,244,240,0.92)] px-4 py-3 backdrop-blur-xl sm:px-5">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white" aria-hidden="true">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
            </svg>
          </div>
          <span className="text-base font-bold tracking-[-0.02em]">AgentDrop</span>
        </Link>

        <div className="flex items-center gap-3 text-sm font-semibold text-brand">{rightSlot}</div>
      </div>
    </nav>
  );
}
