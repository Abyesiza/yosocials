"use client";

import { useId, useState } from "react";
import useSWR from "swr";
import { LuClock } from "react-icons/lu";
import { Button, ErrorNote, Input, cn, focusRing } from "@/app/components/ui";
import { api, type ApiError } from "@/app/lib/api/client";
import type { ScheduleSuggestions } from "@/app/lib/api/types";
import { fromZonedInput, shortZone, toZonedInput, whenIn } from "@/app/lib/audience";
import { useWorkspace } from "./workspace-context";

const isPast = (iso: string) => new Date(iso).getTime() <= Date.now();

/** Best free posting times for these accounts (POST, cached per account list and zone). */
export function useSuggestions(accountIds: string[], { count = 3, timeZone }: { count?: number; timeZone?: string } = {}) {
  const { base } = useWorkspace();
  const ids = [...accountIds].sort();
  const key = ids.length ? ["schedule-suggestions", base, ids.join(","), count, timeZone ?? ""] : null;
  return useSWR<ScheduleSuggestions, ApiError>(
    key,
    () => api<ScheduleSuggestions>(`${base}/schedule/suggestions`, { body: { accountIds: ids.slice(0, 20), count, ...(timeZone && { timeZone }) } }),
    { revalidateOnFocus: false },
  );
}

/**
 * "Change time": the next 3 suggested times for one account, with reasons,
 * plus a manual time in the audience zone. `onPick` errors (like a daily cap) show here.
 * Render it inside a wrapping flex row; the panel takes a full line.
 */
export function ChangeTime({
  accountId,
  zone,
  current,
  onPick,
  label = "Change time",
}: {
  accountId: string;
  zone: string;
  current: string | null;
  onPick: (iso: string) => Promise<void>;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <>
      <Button size="sm" variant="outline" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}>
        <LuClock className="h-4 w-4" aria-hidden /> {label}
      </Button>
      {open && (
        <div id={panelId} className="w-full basis-full">
          <ChangeTimePanel accountId={accountId} zone={zone} current={current} onPick={onPick} onClose={() => setOpen(false)} />
        </div>
      )}
    </>
  );
}

function ChangeTimePanel({
  accountId,
  zone,
  current,
  onPick,
  onClose,
}: {
  accountId: string;
  zone: string;
  current: string | null;
  onPick: (iso: string) => Promise<void>;
  onClose: () => void;
}) {
  const { data, error, isLoading } = useSuggestions([accountId], { timeZone: zone });
  const [manual, setManual] = useState(() => (current ? toZonedInput(current, zone) : ""));
  const [busy, setBusy] = useState<string | null>(null);
  const [pickError, setPickError] = useState<unknown>(null);
  const times = (data?.suggestions ?? []).filter((s) => s.accountId === accountId);

  async function pick(iso: string, key: string) {
    if (isPast(iso)) return setPickError(new Error("Choose a time in the future."));
    setBusy(key);
    setPickError(null);
    try {
      await onPick(iso);
      onClose();
    } catch (e) {
      setPickError(e);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-muted/40 p-4">
      <p className="text-sm font-semibold text-foreground">Suggested times</p>
      {isLoading && <p className="text-sm text-muted-foreground" role="status">Finding the best free times…</p>}
      <ErrorNote error={error} />
      {data && times.length === 0 && <p className="text-sm text-muted-foreground">No free times in the next 7 days. Choose a time below.</p>}
      <ul className="space-y-2">
        {times.map((s) => (
          <li key={s.at}>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => pick(s.at, s.at)}
              className={cn(
                "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-left transition-colors hover:border-primary hover:bg-primary/5 disabled:opacity-60",
                focusRing,
              )}
            >
              <span className="block text-sm font-semibold text-foreground">{busy === s.at ? "Saving…" : whenIn(s.at, zone)}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{s.reason}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-end gap-2">
        <label className="block min-w-0 flex-1 space-y-1.5">
          <span className="text-sm font-semibold text-foreground">Or choose a time ({shortZone(zone)})</span>
          <Input type="datetime-local" value={manual} min={toZonedInput(new Date(), zone)} onChange={(e) => setManual(e.target.value)} />
        </label>
        <Button size="sm" disabled={!manual || busy !== null} loading={busy === "manual"} onClick={() => pick(fromZonedInput(manual, zone), "manual")}>
          Use this time
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
      </div>
      <ErrorNote error={pickError} />
    </div>
  );
}
