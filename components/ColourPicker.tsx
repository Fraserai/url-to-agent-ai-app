"use client";

import { BRAND_COLOURS } from "@/lib/brand";
import { cn } from "@/lib/utils";

type ColourPickerProps = {
  value: string;
  onChange: (value: string) => void;
};

export function ColourPicker({ value, onChange }: ColourPickerProps) {
  return (
    <div>
      <div className="mb-2 text-[11px] font-bold tracking-[0.12em] text-black/30">
        BRAND COLOUR
      </div>
      <div className="flex flex-wrap gap-2">
        {BRAND_COLOURS.map((colour) => (
          <button
            key={colour}
            type="button"
            onClick={() => onChange(colour)}
            className={cn(
              "h-7 w-7 rounded-[8px] border-[2.5px] transition-transform duration-150 hover:scale-105",
              value === colour ? "border-ink" : "border-transparent"
            )}
            style={{ backgroundColor: colour }}
            aria-label={`Choose ${colour}`}
          />
        ))}
      </div>
    </div>
  );
}

