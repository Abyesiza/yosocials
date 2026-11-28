"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { LuCircleCheck } from "react-icons/lu";
import { cn, EmptyState, ErrorNote, focusRing, PageHeader, PlatformIcon, platformLabel } from "@/app/components/ui";
import { RowsSkeleton } from "@/app/components/skeletons";
import { useApi } from "@/app/lib/api/client";
import type { Account, Platform, PlatformInfo } from "@/app/lib/api/types";
import { AccountCard } from "./account-card";
import { ConnectForm } from "./connect-form";
import { OAuthConnect } from "./oauth-connect";
import { useWorkspace } from "./workspace-context";

export function AccountsView() {
  const { base, can, href } = useWorkspace();
  const router = useRouter();
  const query = useSearchParams();
  const connected = query.get("connected");
  const connectError = query.get("connect_error");
  const { data: accounts, error, mutate } = useApi<Account[]>(`${base}/accounts`);
  const { data: platforms } = useApi<PlatformInfo[]>("/integrations");
  const [connecting, setConnecting] = useState<Platform | null>(null);
  const admin = can("admin");
  const chosen = platforms?.find((p) => p.platform === connecting);
  const dismiss = () => router.replace(href("/accounts"));

  return (
    <div>
      <PageHeader eyebrow="Connections" title="Accounts" subtitle="The social accounts this workspace posts to, including Telegram and Discord channels." />

      {connected && (
        <p role="status" className="mb-6 flex items-center gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          <LuCircleCheck className="h-4 w-4 shrink-0" aria-hidden /> {platformLabel(connected)} account connected. You can post to it now.
          <button type="button" onClick={dismiss} className="ml-auto text-xs font-semibold underline underline-offset-4">Dismiss</button>
        </p>
      )}
      {connectError && <div className="mb-6"><ErrorNote error={connectError} /></div>}

      {admin && (
        <section aria-labelledby="connect-heading" className="mb-10 space-y-4">
          <h2 id="connect-heading" className="text-sm font-semibold text-foreground">Connect an account</h2>
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
                <span className="text-[11px] font-normal text-muted-foreground">{p.supportsMetrics ? "Posts and analytics" : "Posts only"}</span>
              </button>
            ))}
          </div>
          {chosen?.connect === "oauth" && <OAuthConnect key={chosen.platform} platform={chosen.platform} available={chosen.available} />}
          {chosen?.connect === "credentials" && (
            <ConnectForm key={chosen.platform} platform={chosen.platform} onDone={async () => { setConnecting(null); await mutate(); }} />
          )}
        </section>
      )}

      <section aria-labelledby="connected-heading" className="space-y-4">
        <h2 id="connected-heading" className="text-sm font-semibold text-foreground">Connected accounts</h2>
        <ErrorNote error={error} />
        {!accounts && !error && <RowsSkeleton rows={3} />}
        {accounts?.length === 0 && <EmptyState title="No accounts connected yet" body={admin ? "Choose a platform above to connect your first account." : "Ask a workspace admin to connect one."} />}
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {accounts?.map((a) => <AccountCard key={a.id} account={a} onChange={() => mutate()} />)}
        </div>
      </section>
    </div>
  );
}
