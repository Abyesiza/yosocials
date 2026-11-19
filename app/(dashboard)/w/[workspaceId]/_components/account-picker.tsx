"use client";

import { Avatar, Chip, PlatformIcon } from "@/app/components/ui";
import type { Account } from "@/app/lib/api/types";

export function AccountPicker({
  accounts,
  selected,
  onChange,
  label = "Post to",
}: {
  accounts: Account[];
  selected: string[];
  onChange: (ids: string[]) => void;
  label?: string;
}) {
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  return (
    <fieldset>
      <legend className="mb-3 text-sm font-semibold text-foreground">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {accounts.map((a) => (
          <Chip key={a.id} active={selected.includes(a.id)} onClick={() => toggle(a.id)} className="pl-1.5">
            <Avatar name={a.displayName} src={a.avatarUrl} size={24} />
            <PlatformIcon platform={a.platform} size={14} />
            {a.displayName}
          </Chip>
        ))}
      </div>
    </fieldset>
  );
}
