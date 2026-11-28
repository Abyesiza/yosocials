"use client";

import { useState } from "react";
import { useSWRConfig } from "swr";
import { Button, Card, CardHeader, ErrorNote } from "@/app/components/ui";
import { api } from "@/app/lib/api/client";
import { countryName, zoneOptionLabel } from "@/app/lib/audience";
import { AudienceFields, type Audience } from "./audience-fields";
import { useWorkspace } from "./workspace-context";

/** Workspace settings: where the audience lives. Admins edit it; others see it. */
export function AudienceCard() {
  const { base, workspace, can } = useWorkspace();
  const { mutate } = useSWRConfig();
  const saved: Audience = { country: workspace?.audienceCountry ?? "", timeZone: workspace?.audienceTimeZone ?? "" };
  const [draft, setDraft] = useState<Audience | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState(false);
  const value = draft ?? saved;
  const dirty = Boolean(draft) && (draft!.country !== saved.country || draft!.timeZone !== saved.timeZone);

  async function save() {
    setPending(true);
    setError(null);
    setDone(false);
    try {
      await api(base, { method: "PATCH", body: { audienceCountry: value.country || null, audienceTimeZone: value.timeZone || null } });
      await mutate("/me");
      setDraft(null);
      setDone(true);
    } catch (e) {
      setError(e);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="h-fit">
      <CardHeader title="Audience" />
      <div className="space-y-4 p-5">
        <p className="text-sm text-muted-foreground">Suggested posting times and trends use where your audience lives.</p>
        {can("admin") ? (
          <>
            <AudienceFields value={value} onChange={(next) => { setDraft(next); setDone(false); }} />
            <ErrorNote error={error} />
            {done && <p role="status" className="text-sm text-success">Saved. New plans and suggested times use this audience.</p>}
            <Button variant="outline" loading={pending} disabled={!dirty} onClick={save}>Save audience</Button>
          </>
        ) : (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-semibold text-foreground">Audience country</dt>
              <dd className="text-muted-foreground">{saved.country ? countryName(saved.country) : "Not set"}</dd>
            </div>
            <div>
              <dt className="font-semibold text-foreground">Audience time zone</dt>
              <dd className="text-muted-foreground">{saved.timeZone ? zoneOptionLabel(saved.timeZone) : "Not set"}</dd>
            </div>
            <p className="text-xs text-muted-foreground sm:col-span-2">Only workspace admins can change the audience.</p>
          </dl>
        )}
      </div>
    </Card>
  );
}
