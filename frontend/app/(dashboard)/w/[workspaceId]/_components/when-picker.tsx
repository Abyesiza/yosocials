"use client";

import type { ReactNode } from "react";
import { Chip, Input } from "@/app/components/ui";
import { toLocalInput } from "@/app/lib/format";

export type When = "now" | "schedule" | "draft";

const OPTIONS: [When, string][] = [
  ["now", "Publish now"],
  ["schedule", "Schedule"],
  ["draft", "Save as draft"],
];

export function WhenPicker({
  when,
  onWhen,
  scheduledAt,
  onScheduledAt,
  children,
}: {
  when: When;
  onWhen: (w: When) => void;
  scheduledAt: string;
  onScheduledAt: (v: string) => void;
  /** Shown under the time when scheduling, e.g. suggested times. */
  children?: ReactNode;
}) {
  return (
    <fieldset>
      <legend className="mb-3 text-sm font-semibold text-foreground">When</legend>
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map(([value, label]) => (
          <Chip key={value} active={when === value} onClick={() => onWhen(value)}>
            {label}
          </Chip>
        ))}
      </div>
      {when === "schedule" && (
        <Input
          type="datetime-local"
          aria-label="Publish date and time"
          value={scheduledAt}
          min={toLocalInput(new Date())}
          onChange={(e) => onScheduledAt(e.target.value)}
          className="mt-3 max-w-xs"
        />
      )}
      {when === "schedule" && children}
    </fieldset>
  );
}
