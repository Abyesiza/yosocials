"use client";

import { Card, cn, PlatformIcon, platformLabel, Textarea } from "@/app/components/ui";
import type { Account, PlatformInfo } from "@/app/lib/api/types";
import { graphemes } from "@/app/lib/format";

export function lengthFor(text: string, cap?: PlatformInfo) {
  return cap?.lengthUnit === "graphemes" ? graphemes(text) : text.length;
}

/** One account's version of the post, with its own limit and optional override. */
export function PlatformPreview({
  account,
  cap,
  text,
  custom,
  onCustomize,
  onReset,
  onChange,
}: {
  account: Account;
  cap?: PlatformInfo;
  text: string;
  custom: boolean;
  onCustomize: () => void;
  onReset: () => void;
  onChange: (text: string) => void;
}) {
  const n = lengthFor(text, cap);
  const over = cap ? n > cap.maxTextLength : false;
  const label = platformLabel(account.platform);
  return (
    <Card className={cn("p-4", over && "border-destructive")}>
      <div className="mb-2 flex items-center gap-2 text-sm">
        <PlatformIcon platform={account.platform} />
        <span className="font-semibold text-foreground">{label}</span>
        <span className="truncate text-muted-foreground">{account.handle}</span>
        <span className={cn("ml-auto text-xs font-semibold tabular-nums", over ? "text-destructive" : "text-muted-foreground")}>
          {n}
          {cap && ` / ${cap.maxTextLength}`}
          {over && <span className="sr-only"> (too long)</span>}
        </span>
      </div>
      {custom ? (
        <>
          <Textarea aria-label={`Text for ${label}`} value={text} onChange={(e) => onChange(e.target.value)} rows={4} />
          <button type="button" onClick={onReset} className="mt-2 min-h-11 text-xs font-semibold text-muted-foreground hover:text-foreground sm:min-h-0">
            Use the main text instead
          </button>
        </>
      ) : (
        <>
          <p className="whitespace-pre-wrap text-sm text-foreground">
            {text || <span className="text-muted-foreground">Your text will appear here</span>}
          </p>
          <button type="button" onClick={onCustomize} className="mt-2 min-h-11 text-xs font-semibold text-primary hover:underline sm:min-h-0">
            Customize for {label}
          </button>
        </>
      )}
    </Card>
  );
}
