"use client";

import { PLATFORMS } from "@/lib/brand";
import type { PlatformId } from "@/lib/types";

type PlatformListProps = {
  onSelect: (platform: PlatformId) => void;
};

export function PlatformList({ onSelect }: PlatformListProps) {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-2">
      {PLATFORMS.map((platform) => (
        <button
          key={platform.id}
          type="button"
          onClick={() => onSelect(platform.id)}
          className="flex w-full items-center gap-4 rounded-xl border border-black/8 bg-white px-4 py-4 text-left transition duration-150 hover:-translate-y-0.5 hover:shadow-card"
        >
          <div
            className="flex h-10 w-10 flex-none items-center justify-center rounded-[10px] font-extrabold"
            style={{
              backgroundColor: `${platform.color}15`,
              color: platform.color
            }}
          >
            {platform.icon}
          </div>
          <span className="flex-1 text-sm font-semibold">Deploy to {platform.name}</span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(0,0,0,0.22)"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      ))}
    </div>
  );
}

