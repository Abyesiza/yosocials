"use client";

import { useId, useState } from "react";
import { Chip, ErrorNote, platformLabel } from "@/app/components/ui";
import type { Account, PlatformInfo, ScheduleSuggestion } from "@/app/lib/api/types";
import { browserZone, describeLimits, shortZone, whenIn } from "@/app/lib/audience";
import { useSuggestions } from "./schedule-suggestions";

interface Option {
  at: string;
  who: string;
  reason: string;
}

/** One shared time when every account has it free, otherwise each account's best time. */
function optionsFor(accounts: Account[], suggestions: ScheduleSuggestion[]): Option[] {
  const byAccount = accounts.map((a) => ({ account: a, times: suggestions.filter((s) => s.accountId === a.id) }));
  const [first, ...rest] = byAccount;
  const shared = first?.times.find((s) => rest.every((r) => r.times.some((t) => t.at === s.at)));
  if (shared && accounts.length > 1) {
    const reasons = byAccount.map((b) => b.times.find((t) => t.at === shared.at)!.reason);
    return [{ at: shared.at, who: "All accounts", reason: [...new Set(reasons)].join(" ") }];
  }
  return byAccount.flatMap(({ account, times }) =>
    times[0] ? [{ at: times[0].at, who: `${account.displayName} on ${platformLabel(account.platform)}`, reason: times[0].reason }] : [],
  );
}

export function SuggestedTimes({
  accounts,
  caps,
  zone,
  selected,
  onPick,
}: {
  accounts: Account[];
  caps: PlatformInfo[];
  zone: string;
  /** The chosen time as UTC ISO, to mark the matching chip. */
  selected: string | null;
  onPick: (iso: string) => void;
}) {
  const { data, error, isLoading } = useSuggestions(accounts.map((a) => a.id), { timeZone: zone });
  const [shown, setShown] = useState<string | null>(null);
  const reasonId = useId();
  const options = data ? optionsFor(accounts, data.suggestions) : [];
  const reason = options.find((o) => o.at === shown)?.reason;
  const ownZone = browserZone();

  return (
    <div className="mt-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-foreground">Suggested times <span className="font-normal text-muted-foreground">({shortZone(zone)}, your audience’s time)</span></p>
        {isLoading && <p role="status" className="mt-1 text-xs text-muted-foreground">Finding the best free times…</p>}
      </div>
      <ErrorNote error={error} />
      {data && options.length === 0 && <p className="text-xs text-muted-foreground">No free times in the next 7 days for these accounts. Choose a time above.</p>}
      {options.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {options.map((o) => (
            <Chip
              key={`${o.who}-${o.at}`}
              active={selected === o.at}
              aria-describedby={shown === o.at ? reasonId : undefined}
              onMouseEnter={() => setShown(o.at)}
              onFocus={() => setShown(o.at)}
              onClick={() => {
                setShown(o.at);
                onPick(o.at);
              }}
            >
              {whenIn(o.at, zone)}
              <span className="text-xs font-normal text-muted-foreground">· {o.who}</span>
            </Chip>
          ))}
        </div>
      )}
      <p id={reasonId} aria-live="polite" className="text-xs text-muted-foreground empty:hidden">{reason && `Why this time: ${reason}`}</p>
      {zone !== ownZone && <p className="text-xs text-muted-foreground">The date and time box uses your own time zone ({shortZone(ownZone)}).</p>}
      {caps.length > 0 && (
        <ul className="space-y-0.5 text-xs text-muted-foreground" aria-label="Posting limits">
          {caps.map((c) => (
            <li key={c.platform}>{platformLabel(c.platform)}: {describeLimits(c.posting.maxPerDay, c.posting.minSpacingMinutes)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
