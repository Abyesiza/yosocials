"use client";

import Link from "next/link";
import { useState } from "react";
import { LuMapPin, LuX } from "react-icons/lu";
import { focusRing } from "@/app/components/ui";
import { useWorkspace } from "./workspace-context";

const keyFor = (workspaceId: string) => `aby-audience-nudge:${workspaceId}`;

function wasDismissed(workspaceId: string): boolean {
  try {
    return localStorage.getItem(keyFor(workspaceId)) === "1";
  } catch {
    return false;
  }
}

/** A small, dismissible prompt to set the audience country while it's missing. */
export function AudienceNudge() {
  const { workspace, workspaceId, href, can } = useWorkspace();
  const [dismissed, setDismissed] = useState(() => typeof window !== "undefined" && wasDismissed(workspaceId));
  if (!workspace || workspace.audienceCountry || dismissed) return null;

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(keyFor(workspaceId), "1");
    } catch {
      // Blocked storage: hidden for this visit only.
    }
  }

  return (
    <div role="note" className="mb-6 flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground">
      <LuMapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
      <p className="flex-1">
        {can("admin") ? (
          <>
            Set your audience’s country so we can suggest the best times and trends.{" "}
            <Link href={href("/settings")} className="font-semibold text-primary underline underline-offset-2">Set audience</Link>
          </>
        ) : (
          "Ask a workspace admin to set your audience’s country, so we can suggest the best times and trends."
        )}
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss audience reminder"
        className={`-m-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground ${focusRing}`}
      >
        <LuX className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
