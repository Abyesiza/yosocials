"use client";

import { useState } from "react";
import { LuExternalLink, LuRefreshCw, LuTrash2 } from "react-icons/lu";
import { Avatar, Badge, Button, Card, ErrorNote, PlatformIcon } from "@/app/components/ui";
import { api } from "@/app/lib/api/client";
import type { Account, AccountPersona } from "@/app/lib/api/types";
import { useWorkspace } from "./workspace-context";

const PERSONA: Record<AccountPersona, string> = { individual: "Person", influencer: "Creator", company: "Brand" };

export function AccountCard({ account, onChange }: { account: Account; onChange: () => void }) {
  const { base, can } = useWorkspace();
  const [busy, setBusy] = useState<"verify" | "remove" | null>(null);
  const [error, setError] = useState<unknown>(null);

  async function run(kind: "verify" | "remove", call: () => Promise<unknown>) {
    setBusy(kind);
    setError(null);
    try {
      await call();
      onChange();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  }

  const disconnect = () => {
    if (!confirm(`Disconnect ${account.handle}? Its posts and stats are removed from Aby Socials.`)) return;
    void run("remove", () => api(`${base}/accounts/${account.id}`, { method: "DELETE" }));
  };

  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-center gap-3">
        <span className="relative">
          <Avatar name={account.displayName} src={account.avatarUrl} size={48} />
          <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-card p-0.5"><PlatformIcon platform={account.platform} size={15} /></span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-foreground">{account.displayName}</p>
          <p className="truncate text-sm text-muted-foreground">{account.handle} · {PERSONA[account.persona]}</p>
          {account.profileUrl && (
            <a href={account.profileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-primary hover:underline sm:min-h-0">
              View profile <LuExternalLink className="h-3 w-3" aria-hidden />
            </a>
          )}
        </div>
        {account.status === "needs_reconnect" ? <Badge variant="destructive">Reconnect</Badge> : <Badge variant="success">Connected</Badge>}
      </div>
      {account.lastError && <p className="mt-3 text-xs text-destructive">{account.lastError}</p>}
      {can("admin") && (
        <div className="mt-4 flex gap-2 border-t border-border pt-4">
          <Button size="sm" variant="outline" loading={busy === "verify"} onClick={() => run("verify", () => api(`${base}/accounts/${account.id}/verify`, { method: "POST" }))}>
            <LuRefreshCw className="h-3.5 w-3.5" aria-hidden /> Check
          </Button>
          <Button size="sm" variant="destructive-ghost" loading={busy === "remove"} onClick={disconnect}>
            <LuTrash2 className="h-3.5 w-3.5" aria-hidden /> Disconnect
          </Button>
        </div>
      )}
      <div className="mt-2"><ErrorNote error={error} /></div>
    </Card>
  );
}
