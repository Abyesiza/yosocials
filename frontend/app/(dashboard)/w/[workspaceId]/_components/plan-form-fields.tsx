"use client";

import type { ReactNode } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";
import type { z } from "zod";
import { Field, Input, Select, Textarea, cn, focusRing, platformLabel } from "@/app/components/ui";
import type { Account, PlatformInfo } from "@/app/lib/api/types";
import type { planSchema } from "@/app/lib/validation/schemas";
import { AccountPicker } from "./account-picker";
import { AudienceFields, type Audience } from "./audience-fields";
import { todayIn } from "./calendar-utils";

export interface PlanToggles {
  useTrends: boolean;
  searchWeb: boolean;
}

type PlanForm = UseFormReturn<z.input<typeof planSchema>, unknown, z.output<typeof planSchema>>;

const TIKTOK_SOUNDS = "https://ads.tiktok.com/business/creativecenter/inspiration/popular/music/pc/en";

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (on: boolean) => void; label: string; hint: ReactNode }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={cn("mt-0.5 h-5 w-5 shrink-0 accent-[hsl(var(--primary))]", focusRing)}
      />
      <span>
        <span className="block text-sm font-semibold text-foreground">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </label>
  );
}

/** The plan form's fields: brief, accounts, dates, pace, audience and AI options. */
export function PlanFormFields({
  form,
  accounts,
  caps,
  chosen,
  onChosen,
  audience,
  onAudience,
  toggles,
  onToggles,
  canSearchWeb,
}: {
  form: PlanForm;
  accounts: Account[];
  caps: PlatformInfo[];
  chosen: string[];
  onChosen: (ids: string[]) => void;
  audience: Audience;
  onAudience: (a: Audience) => void;
  toggles: PlanToggles;
  onToggles: (t: PlanToggles) => void;
  canSearchWeb: boolean;
}) {
  const { errors } = form.formState;
  const perWeek = Number(useWatch({ control: form.control, name: "postsPerWeekPerAccount" }));
  const platforms = [...new Set(accounts.filter((a) => chosen.includes(a.id)).map((a) => a.platform))];
  const limits = platforms.flatMap((p) => caps.find((c) => c.platform === p) ?? []);
  const capped = limits.filter((c) => perWeek > c.posting.maxPerDay * 7);

  return (
    <>
      <Field label="Brief" hint="Goal, audience, offers, tone. The more specific, the better." error={errors.brief?.message}>
        <Textarea rows={6} aria-invalid={Boolean(errors.brief)} placeholder="Launch week for our budgeting app. Audience: young professionals in Kampala. Goal: waitlist sign-ups. Friendly, no jargon." {...form.register("brief")} />
      </Field>
      <AccountPicker accounts={accounts} selected={chosen} onChange={onChosen} label="Accounts" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Start date" error={errors.startDate?.message}>
          <Input type="date" min={todayIn(audience.timeZone)} aria-invalid={Boolean(errors.startDate)} {...form.register("startDate")} />
        </Field>
        <Field label="Length">
          <Select {...form.register("days")}>{[3, 7, 14, 30].map((d) => <option key={d} value={d}>{d} days</option>)}</Select>
        </Field>
        <Field label="Posts per week, per account">
          <Select {...form.register("postsPerWeekPerAccount")}>{[1, 2, 3, 4, 5, 7, 10, 14, 21].map((n) => <option key={n} value={n}>{n}</option>)}</Select>
        </Field>
      </div>
      {limits.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Daily limits: {limits.map((c) => `${platformLabel(c.platform)} ${c.posting.maxPerDay}`).join(", ")}.
          {capped.length > 0 && ` We’ll plan fewer for ${capped.map((c) => platformLabel(c.platform)).join(" and ")} to stay within the limit.`}
        </p>
      )}
      <AudienceFields
        value={audience}
        requireZone
        onChange={onAudience}
        countryHint="Changes this plan only. Set the default in workspace settings."
        zoneHint="We pick posting times in this time zone."
      />
      <Toggle
        checked={toggles.useTrends}
        onChange={(useTrends) => onToggles({ ...toggles, useTrends })}
        label="Use what’s trending"
        hint="AI looks at Google Trends for your audience’s country, and Mastodon and Bluesky, and uses trends that fit your brief."
      />
      {canSearchWeb && (
        <Toggle
          checked={toggles.searchWeb}
          onChange={(searchWeb) => onToggles({ ...toggles, searchWeb })}
          label="Search the web for what’s trending"
          hint="AI searches Google first. Planning takes a little longer."
        />
      )}
      {platforms.includes("tiktok") && (
        <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
          TikTok sounds: choose one from TikTok’s Commercial Music Library in the TikTok app.{" "}
          <a href={TIKTOK_SOUNDS} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline underline-offset-2">
            TikTok Creative Center<span className="sr-only"> (opens in a new tab)</span>
          </a>{" "}
          shows which sounds are trending. TikTok doesn’t let apps choose sounds, so we can’t add one for you.
        </p>
      )}
    </>
  );
}
