"use client";

import { useState } from "react";
import { cn, EmptyState, ErrorNote, focusRing, PageHeader, PlatformIcon } from "@/app/components/ui";
import { RowsSkeleton } from "@/app/components/skeletons";
import { useApi } from "@/app/lib/api/client";
import type { Account, Platform, PlatformInfo } from "@/app/lib/api/types";
import { AccountCard } from "./account-card";
import { ConnectForm } from "./connect-form";
import { useWorkspace } from "./workspace-context";

export function AccountsView() {
  const { base, can } = useWorkspace();
  const { data: accounts, error, mutate } = useApi<Account[]>(`${base}/accounts`);
  const { data: platforms } = useApi<PlatformInfo[]>("/integrations");
  const [connecting, setConnecting] = useState<Platform | null>(null);
  const admin = can("admin");

  return (
    <div>
      <PageHeader eyebrow="Channels" title="Accounts" subtitle="The social accounts and channels this workspace posts to." />

      {admin && (
        <section aria-labelledby="connect-heading" className="mb-10 space-y-4">
          <h2 id="connect-heading" className="text-sm font-semibold text-foreground">Connect a platform</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {(platforms ?? []).map((p) => (
              <button
                key={p.platform}
                type="button"
                onClick={() => setConnecting(connecting === p.platform ? null : p.platform)}
                aria-pressed={connecting === p.platform}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border bg-card px-3 py-5 text-sm font-semibold text-foreground shadow-sm transition-all hover:shadow-md active:scale-[0.98] motion-reduce:transform-none",
                  focusRing,
                  connecting === p.platform ? "border-primary ring-1 ring-primary" : "border-border",
                )}
              >
                <PlatformIcon platform={p.platform} size={26} />
                {p.displayName}
                <span className="text-[11px] font-normal text-muted-foreground">{p.supportsMetrics ? "Posts + stats" : "Posts only"}</span>
              </button>
            ))}
          </div>
          {connecting && (
            <ConnectForm key={connecting} platform={connecting} onDone={async () => { setConnecting(null); await mutate(); }} />
          )}
        </section>
      )}

      <section aria-labelledby="connected-heading" className="space-y-4">
        <h2 id="connected-heading" className="text-sm font-semibold text-foreground">Connected</h2>
        <ErrorNote error={error} />
        {!accounts && !error && <RowsSkeleton rows={3} />}
        {accounts?.length === 0 && <EmptyState title="No accounts yet" body={admin ? "Pick a platform above to connect one." : "Ask an admin to connect one."} />}
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {accounts?.map((a) => <AccountCard key={a.id} account={a} onChange={() => mutate()} />)}
        </div>
      </section>
    </div>
  );
}
