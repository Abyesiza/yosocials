"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { LuCheck, LuChevronDown, LuPlus } from "react-icons/lu";
import { cn, focusRing } from "@/app/components/ui";
import { Bone } from "@/app/components/skeletons";
import { useDismiss } from "@/app/lib/hooks/use-dismiss";
import { useWorkspace } from "./workspace-context";

export function WorkspaceSwitcher() {
  const { me, workspace, workspaceId } = useWorkspace();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss<HTMLDivElement>(open, close);

  if (!workspace) return <Bone className="h-14 w-full" />;

  const item = "flex min-h-11 items-center gap-2 rounded-md px-3 text-sm text-foreground hover:bg-muted";
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          "flex w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-left hover:bg-muted",
          focusRing,
        )}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-foreground text-xs font-bold text-background">
          {workspace.name[0]?.toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground">{workspace.name}</span>
          <span className="block text-xs capitalize text-muted-foreground">{workspace.role}</span>
        </span>
        <LuChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute inset-x-0 z-50 mt-1 rounded-md border border-border bg-card p-1 shadow-md">
          {me?.workspaces.map((w) => (
            <Link key={w.id} role="menuitem" href={`/w/${w.id}`} onClick={close} className={cn(item, focusRing)}>
              <span className="min-w-0 flex-1 truncate">{w.name}</span>
              {w.id === workspaceId && <LuCheck className="h-4 w-4 text-primary" aria-label="Current workspace" />}
            </Link>
          ))}
          <div className="my-1 border-t border-border" />
          <Link role="menuitem" href="/workspaces/new" onClick={close} className={cn(item, "font-semibold", focusRing)}>
            <LuPlus className="h-4 w-4" aria-hidden /> New workspace
          </Link>
        </div>
      )}
    </div>
  );
}
