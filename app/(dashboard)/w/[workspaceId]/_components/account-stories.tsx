"use client";

import type { ReactNode } from "react";
import { Avatar, cn, focusRing, PlatformIcon } from "@/app/components/ui";
import { Bone } from "@/app/components/skeletons";
import type { Account } from "@/app/lib/api/types";

/** Instagram's stories row, used to filter the feed by account. */
export function AccountStories({
  accounts,
  selected,
  onSelect,
}: {
  accounts: Account[] | undefined;
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  if (!accounts) {
    return (
      <div className="mb-6 flex gap-4">
        {[0, 1, 2, 3].map((i) => (
          <Bone key={i} className="h-16 w-16 rounded-full" />
        ))}
      </div>
    );
  }
  if (accounts.length === 0) return null;
  return (
    <div role="group" aria-label="Filter by account" className="-mx-1 mb-6 flex gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:none]">
      <Story active={selected === null} onClick={() => onSelect(null)} label="All">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-foreground text-sm font-bold text-background">All</span>
      </Story>
      {accounts.map((a) => (
        <Story key={a.id} active={selected === a.id} onClick={() => onSelect(selected === a.id ? null : a.id)} label={a.displayName}>
          <span className="relative">
            <Avatar name={a.displayName} src={a.avatarUrl} size={56} ring={selected === a.id} />
            <span className="absolute bottom-0 right-0 rounded-full bg-background p-0.5">
              <PlatformIcon platform={a.platform} size={14} />
            </span>
          </span>
        </Story>
      ))}
    </div>
  );
}

function Story({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex w-[4.5rem] shrink-0 flex-col items-center gap-1 rounded-md py-1 transition-transform hover:scale-[1.01] active:scale-[0.98] motion-reduce:transform-none",
        focusRing,
        !active && "opacity-80 hover:opacity-100",
      )}
    >
      {children}
      <span className={cn("w-full truncate text-center text-xs", active ? "font-semibold text-foreground" : "text-muted-foreground")}>
        {label}
      </span>
    </button>
  );
}
