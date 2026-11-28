"use client";

import { LuFilterX } from "react-icons/lu";
import { Avatar, Button, Chip, PlatformIcon, platformLabel, Select } from "@/app/components/ui";
import type { Account, Platform } from "@/app/lib/api/types";
import type { CalendarPrefs, StatusFilter } from "./calendar-utils";

const STATUS_OPTIONS: [StatusFilter, string][] = [
  ["all", "All statuses"],
  ["draft", "Drafts"],
  ["scheduled", "Scheduled"],
  ["processing", "Publishing"],
  ["published", "Published"],
  ["failed", "Failed"],
];

const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

type Filters = Pick<CalendarPrefs, "platforms" | "accounts" | "status">;

export function CalendarFilters({
  accounts,
  value,
  onChange,
}: {
  accounts: Account[];
  value: Filters;
  onChange: (next: Filters) => void;
}) {
  const platforms = [...new Set(accounts.map((a) => a.platform))];
  const shownAccounts = value.platforms.length ? accounts.filter((a) => value.platforms.includes(a.platform)) : accounts;
  const active = value.platforms.length > 0 || value.accounts.length > 0 || value.status !== "all";

  const setPlatforms = (next: Platform[]) => {
    const keep = new Set(accounts.filter((a) => !next.length || next.includes(a.platform)).map((a) => a.id));
    onChange({ ...value, platforms: next, accounts: value.accounts.filter((id) => keep.has(id)) });
  };

  return (
    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end lg:gap-6">
      {platforms.length > 1 && (
        <fieldset>
          <legend className="mb-1.5 text-xs font-semibold text-muted-foreground">Platforms</legend>
          <div className="flex flex-wrap gap-2">
            {platforms.map((p) => (
              <Chip key={p} active={value.platforms.includes(p)} onClick={() => setPlatforms(toggle(value.platforms, p))}>
                <PlatformIcon platform={p} size={14} />
                {platformLabel(p)}
              </Chip>
            ))}
          </div>
        </fieldset>
      )}
      {shownAccounts.length > 1 && (
        <fieldset>
          <legend className="mb-1.5 text-xs font-semibold text-muted-foreground">Accounts</legend>
          <div className="flex flex-wrap gap-2">
            {shownAccounts.map((a) => (
              <Chip key={a.id} active={value.accounts.includes(a.id)} onClick={() => onChange({ ...value, accounts: toggle(value.accounts, a.id) })}>
                <Avatar name={a.displayName} src={a.avatarUrl} size={20} />
                <span className="max-w-40 truncate">{a.displayName}</span>
                <span className="sr-only">on {platformLabel(a.platform)}</span>
              </Chip>
            ))}
          </div>
        </fieldset>
      )}
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Status</span>
        <Select value={value.status} onChange={(e) => onChange({ ...value, status: e.target.value as StatusFilter })} className="w-48 rounded-full">
          {STATUS_OPTIONS.map(([v, label]) => (
            <option key={v} value={v}>{label}</option>
          ))}
        </Select>
      </label>
      {active && (
        <Button variant="ghost" size="sm" onClick={() => onChange({ platforms: [], accounts: [], status: "all" })}>
          <LuFilterX className="h-4 w-4" aria-hidden /> Clear filters
        </Button>
      )}
    </div>
  );
}
