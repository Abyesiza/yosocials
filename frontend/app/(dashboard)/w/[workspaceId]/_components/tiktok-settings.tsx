"use client";

import { useState, type ReactNode } from "react";
import { Avatar, Card, cn, ErrorNote, Field, Input, PlatformIcon, Select } from "@/app/components/ui";
import { useApi } from "@/app/lib/api/client";
import type { Account, TikTokCreatorInfo, TikTokOptions, TikTokPrivacyLevel } from "@/app/lib/api/types";
import { useWorkspace } from "./workspace-context";

const PRIVACY: Record<TikTokPrivacyLevel, string> = {
  PUBLIC_TO_EVERYONE: "Everyone",
  MUTUAL_FOLLOW_FRIENDS: "Friends (followers you follow back)",
  FOLLOWER_OF_CREATOR: "Followers",
  SELF_ONLY: "Only me",
};

const MUSIC_TERMS = "https://www.tiktok.com/legal/page/global/music-usage-confirmation/en";
const BRANDED_POLICY = "https://www.tiktok.com/legal/page/global/bc-policy/en";

export interface MediaSummary {
  kind: "video" | "image" | null;
  durationSec: number | null;
}

/** Why these settings can't be posted yet; empty when ready. */
export function tiktokIssues(options: TikTokOptions | undefined, info: TikTokCreatorInfo | undefined, media: MediaSummary, disclose: boolean): string[] {
  const issues: string[] = [];
  if (!media.kind) issues.push("Add a video or photos for TikTok.");
  if (!options?.mode) return [...issues, "Choose how to post to TikTok."];
  if (options.mode === "direct") {
    if (!options.privacyLevel) issues.push("Choose who can see the TikTok post.");
    const max = info?.maxVideoPostDurationSec;
    if (media.kind === "video" && max && media.durationSec && media.durationSec > max) {
      issues.push(`This TikTok account can post videos up to ${max} seconds.`);
    }
  }
  if (disclose && !options.brandOrganic && !options.brandedContent) {
    issues.push("Say whether the TikTok post promotes your brand, a third party, or both.");
  }
  if (options.brandedContent && options.privacyLevel === "SELF_ONLY") {
    issues.push("Branded content can’t be private on TikTok.");
  }
  return issues;
}

/** One line describing saved settings, for read-only views. */
export function describeTikTok(o: TikTokOptions | null | undefined): string {
  if (!o?.mode) return "Posting settings not chosen yet";
  if (o.mode === "inbox") return "Sent to the TikTok inbox as a draft";
  const allowed = [o.allowComment && "comments", o.allowDuet && "Duets", o.allowStitch && "Stitches"].filter(Boolean);
  return [
    `Posted to the profile · ${o.privacyLevel ? PRIVACY[o.privacyLevel] : "audience not chosen"}`,
    allowed.length ? `allows ${allowed.join(", ")}` : "no comments, Duets or Stitches",
    o.brandedContent ? "Paid partnership" : o.brandOrganic ? "Promotional content" : null,
    o.isAigc ? "AI-generated label" : null,
  ].filter(Boolean).join(" · ");
}

export function useCreatorInfo(accountId: string) {
  const { base } = useWorkspace();
  return useApi<TikTokCreatorInfo>(`${base}/accounts/${accountId}/creator-info`, { revalidateOnFocus: false });
}

/**
 * How a post goes out on one TikTok account, laid out the way TikTok's
 * content-sharing guidelines require: nothing is preselected for the creator.
 */
export function TikTokSettings({
  account,
  value,
  onChange,
  media,
  disclose,
  onDisclose,
}: {
  account: Pick<Account, "id" | "displayName" | "avatarUrl" | "handle">;
  value: TikTokOptions | undefined;
  onChange: (options: TikTokOptions) => void;
  media: MediaSummary;
  disclose: boolean;
  onDisclose: (on: boolean) => void;
}) {
  const { data: info, error } = useCreatorInfo(account.id);
  const set = (patch: Partial<TikTokOptions>) => onChange({ ...(value ?? { mode: "direct" }), ...patch } as TikTokOptions);
  const direct = value?.mode === "direct";
  const video = media.kind === "video";
  const tooLong = video && direct && info?.maxVideoPostDurationSec && media.durationSec && media.durationSec > info.maxVideoPostDurationSec;

  return (
    <Card className="space-y-5 p-4">
      <div className="flex items-center gap-3">
        <Avatar name={info?.nickname ?? account.displayName} src={info?.avatarUrl ?? account.avatarUrl} size={36} />
        <div className="min-w-0 flex-1 text-sm">
          <p className="flex items-center gap-1.5 font-semibold text-foreground">
            <PlatformIcon platform="tiktok" size={14} /> Posting to {info?.nickname ?? account.displayName}
          </p>
          <p className="truncate text-xs text-muted-foreground">{info?.username ? `@${info.username}` : account.handle}</p>
        </div>
      </div>
      <ErrorNote error={error} />

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-semibold text-foreground">How to post</legend>
        <Radio name={`mode-${account.id}`} checked={direct} disabled={info ? !info.canDirectPost : false} onChange={() => set({ mode: "direct" })} label="Post to the profile" hint="Goes live on TikTok with the settings below." />
        <Radio name={`mode-${account.id}`} checked={value?.mode === "inbox"} disabled={info ? !info.canUploadToInbox : false} onChange={() => onChange({ mode: "inbox", ...(value?.photoTitle && { photoTitle: value.photoTitle }) })} label="Send to the TikTok inbox as a draft" hint="TikTok notifies the creator, who finishes editing and posts from the app." />
      </fieldset>

      {direct && (
        <>
          <Field label="Who can see this post" hint="While TikTok is still reviewing Aby Socials, the TikTok account must be private (Settings and privacy → Privacy → Private account) and posts must be “Only me”.">
            <Select value={value?.privacyLevel ?? ""} onChange={(e) => set({ privacyLevel: (e.target.value || undefined) as TikTokPrivacyLevel | undefined })} aria-invalid={!value?.privacyLevel}>
              <option value="" disabled>Choose who can see it</option>
              {(info?.privacyLevelOptions ?? []).map((level) => (
                <option key={level} value={level} disabled={level === "SELF_ONLY" && value?.brandedContent}>
                  {PRIVACY[level]}{level === "SELF_ONLY" && value?.brandedContent ? " (not for branded content)" : ""}
                </option>
              ))}
            </Select>
          </Field>

          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-foreground">Allow people to</legend>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <Check label="Comment" checked={Boolean(value?.allowComment)} disabled={info?.commentDisabled} onChange={(v) => set({ allowComment: v })} />
              {video && <Check label="Duet" checked={Boolean(value?.allowDuet)} disabled={info?.duetDisabled} onChange={(v) => set({ allowDuet: v })} />}
              {video && <Check label="Stitch" checked={Boolean(value?.allowStitch)} disabled={info?.stitchDisabled} onChange={(v) => set({ allowStitch: v })} />}
            </div>
            {(info?.commentDisabled || (video && (info?.duetDisabled || info?.stitchDisabled))) && (
              <p className="mt-1 text-xs text-muted-foreground">Greyed-out options are turned off in this account’s TikTok settings.</p>
            )}
          </fieldset>

          <fieldset className="space-y-2">
            <Toggle checked={disclose} onChange={(on) => { onDisclose(on); if (!on) set({ brandOrganic: false, brandedContent: false }); }} label="Disclose commercial content" hint="Turn this on if the post promotes a brand, product or service." />
            {disclose && (
              <div className="space-y-2 pl-1">
                <Check label="Your brand" hint="You’re promoting yourself or your own business." checked={Boolean(value?.brandOrganic)} onChange={(v) => set({ brandOrganic: v })} />
                <Check label="Branded content" hint="You’re promoting another brand or a third party." checked={Boolean(value?.brandedContent)} onChange={(v) => set({ brandedContent: v, ...(v && value?.privacyLevel === "SELF_ONLY" && { privacyLevel: undefined }) })} />
                {(value?.brandOrganic || value?.brandedContent) ? (
                  <p className="text-xs text-muted-foreground">
                    Your {video ? "video" : "photo post"} will be labelled “{value?.brandedContent ? "Paid partnership" : "Promotional content"}”.
                  </p>
                ) : (
                  <p className="text-xs font-medium text-warning">Choose at least one.</p>
                )}
              </div>
            )}
          </fieldset>

          {video && <Check label="Label as AI-generated" hint="Required by TikTok when the video is realistic and made or heavily edited with AI." checked={Boolean(value?.isAigc)} onChange={(v) => set({ isAigc: v })} />}
          {!video && media.kind === "image" && <Check label="Add recommended music" checked={Boolean(value?.autoAddMusic)} onChange={(v) => set({ autoAddMusic: v })} />}
        </>
      )}

      {media.kind === "image" && value?.mode && (
        <Field label="Photo title (optional)" hint="Up to 90 characters. The post text becomes the description.">
          <Input value={value.photoTitle ?? ""} maxLength={90} onChange={(e) => set({ photoTitle: e.target.value || undefined })} />
        </Field>
      )}

      {tooLong && <ErrorNote error={`This account can post videos up to ${info?.maxVideoPostDurationSec} seconds.`} />}
      {value?.mode === "inbox" && video && <p className="text-xs text-muted-foreground">TikTok doesn’t take a caption with inbox videos: add it in the app when you finish the post.</p>}
      {value?.mode && (
        <p className="text-xs text-muted-foreground">
          {direct ? "By posting, you agree to TikTok’s " : "By sending, you agree to TikTok’s "}
          {direct && value?.brandedContent && <><a className="font-medium text-primary underline-offset-4 hover:underline" href={BRANDED_POLICY} target="_blank" rel="noopener noreferrer">Branded Content Policy</a> and </>}
          <a className="font-medium text-primary underline-offset-4 hover:underline" href={MUSIC_TERMS} target="_blank" rel="noopener noreferrer">Music Usage Confirmation</a>.
          {direct && " It can take a few minutes for the post to appear on the profile."}
        </p>
      )}
    </Card>
  );
}

function Radio({ name, checked, disabled, onChange, label, hint }: { name: string; checked: boolean; disabled?: boolean; onChange: () => void; label: string; hint: string }) {
  return (
    <label className={cn("flex min-h-11 cursor-pointer items-start gap-3 rounded-md border border-border p-3 text-sm", checked && "border-primary bg-primary/5", disabled && "cursor-not-allowed opacity-50")}>
      <input type="radio" name={name} checked={checked} disabled={disabled} onChange={onChange} className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]" />
      <span>
        <span className="block font-semibold text-foreground">{label}</span>
        <span className="block text-xs text-muted-foreground">{disabled ? "Not allowed for this account. Reconnect it and allow every permission." : hint}</span>
      </span>
    </label>
  );
}

function Check({ label, hint, checked, disabled, onChange }: { label: string; hint?: ReactNode; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={cn("flex min-h-11 cursor-pointer items-start gap-2 text-sm sm:min-h-0", disabled && "cursor-not-allowed opacity-50")}>
      <input type="checkbox" checked={checked && !disabled} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]" />
      <span>
        <span className="font-medium text-foreground">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start justify-between gap-4 text-sm">
      <span>
        <span className="block font-semibold text-foreground">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span aria-hidden className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-muted transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5 motion-reduce:after:transition-none" />
    </label>
  );
}

/** Keeps each TikTok account's "disclose commercial content" switch, which isn't itself sent. */
export function useDisclosure() {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  return {
    isOpen: (id: string, options?: TikTokOptions) => open[id] ?? Boolean(options?.brandOrganic || options?.brandedContent),
    set: (id: string, on: boolean) => setOpen((o) => ({ ...o, [id]: on })),
  };
}
