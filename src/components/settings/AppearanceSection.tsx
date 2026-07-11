"use client";

import ThemeToggle from "@/components/ThemeToggle";

export default function AppearanceSection() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 text-xs text-muted">
        theme
        <ThemeToggle />
        <span className="text-[10px] text-dim">
          switches instantly, remembered on this device.
        </span>
      </div>
    </div>
  );
}
