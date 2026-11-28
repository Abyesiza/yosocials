"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { Avatar, Button, Card, CardHeader, ErrorNote, Select } from "@/app/components/ui";
import { RowsSkeleton } from "@/app/components/skeletons";
import { api, useApi } from "@/app/lib/api/client";
import type { Member } from "@/app/lib/api/types";
import { AddMemberForm, ROLES, useGrantableRoles } from "./add-member-form";
import { useWorkspace } from "./workspace-context";

export function MembersCard() {
  const { base, me, workspace, can } = useWorkspace();
  const router = useRouter();
  const { mutate: mutateGlobal } = useSWRConfig();
  const members = useApi<Member[]>(`${base}/members`);
  const grantable = useGrantableRoles();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  async function run(key: string, call: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await call();
      return true;
    } catch (e) {
      setError(e);
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function changeRole(m: Member, role: string) {
    await run(`role-${m.userId}`, () => api(`${base}/members/${m.userId}`, { method: "PATCH", body: { role } }));
    await members.mutate();
  }

  async function remove(m: Member, isMe: boolean) {
    if (!confirm(isMe ? `Leave ${workspace?.name}? You’ll lose access to its posts and accounts until someone adds you again.` : `Remove ${m.name} from ${workspace?.name}? They’ll lose access to its posts and accounts.`)) return;
    if (!(await run(`remove-${m.userId}`, () => api(`${base}/members/${m.userId}`, { method: "DELETE" })))) return;
    if (!isMe) return void members.mutate();
    await mutateGlobal("/me");
    router.replace("/dashboard");
  }

  return (
    <Card>
      <CardHeader title="Members" />
      {can("admin") && <AddMemberForm onAdded={() => members.mutate()} />}
      <div className="px-5 pt-3"><ErrorNote error={error} /></div>
      {!members.data ? (
        <div className="p-5"><RowsSkeleton rows={2} /></div>
      ) : (
        <ul className="divide-y divide-border">
          {members.data.map((m) => {
            const isMe = m.userId === me?.user.id;
            const manageable = can("admin") && !isMe && (m.role !== "owner" || can("owner"));
            return (
              <li key={m.userId} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <Avatar name={m.name} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{m.name} {isMe && <span className="font-normal text-muted-foreground">(you)</span>}</p>
                  <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                </div>
                {manageable ? (
                  <Select aria-label={`Role for ${m.name}`} value={m.role} disabled={busy === `role-${m.userId}`} onChange={(e) => changeRole(m, e.target.value)} className="w-32">
                    {grantable.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </Select>
                ) : (
                  <span className="text-xs font-semibold capitalize text-muted-foreground">{m.role}</span>
                )}
                {(manageable || isMe) && (
                  <Button size="sm" variant="destructive-ghost" loading={busy === `remove-${m.userId}`} onClick={() => remove(m, isMe)}>{isMe ? "Leave workspace" : "Remove member"}</Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <ul className="space-y-1 border-t border-border px-5 py-4 text-xs text-muted-foreground">
        {ROLES.map((r) => <li key={r.value}><span className="font-semibold text-foreground">{r.label}:</span> {r.help}</li>)}
      </ul>
    </Card>
  );
}
