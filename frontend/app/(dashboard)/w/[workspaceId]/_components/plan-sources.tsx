"use client";

import type { ReactNode } from "react";
import type { GroundingInfo, PlanResult } from "@/app/lib/api/types";
import { TrendGroups } from "./trends-panel";

function Disclosure({ summary, tone = "muted", children }: { summary: string; tone?: "muted" | "warning"; children: ReactNode }) {
  const look = tone === "warning" ? "border-warning/30 bg-warning/10 text-warning" : "border-border bg-card text-foreground";
  return (
    <details className={`rounded-xl border px-4 py-3 text-sm ${look}`}>
      <summary className="min-h-11 cursor-pointer content-center font-semibold sm:min-h-0">{summary}</summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

/**
 * Google Search suggestions, as Google's terms require: its HTML unchanged,
 * shown only to this person and never stored. It's HTML and CSS only, so the
 * sandbox allows no scripts; the base tag opens its links in a new tab.
 */
function SearchSuggestions({ grounding }: { grounding: GroundingInfo }) {
  return (
    <div className="space-y-3">
      {grounding.searchEntryPointHtml && (
        <iframe
          title="Google Search suggestions"
          sandbox="allow-popups allow-popups-to-escape-sandbox"
          referrerPolicy="no-referrer"
          srcDoc={`<!doctype html><html><head><meta charset="utf-8"><base target="_blank"></head><body style="margin:0">${grounding.searchEntryPointHtml}</body></html>`}
          className="h-24 w-full rounded-xl border border-border bg-background"
        />
      )}
      {grounding.sources.length > 0 && (
        <ul className="space-y-1">
          {grounding.sources.map((s) => (
            <li key={s.uri}>
              <a href={s.uri} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline underline-offset-2">
                {s.title || s.uri}<span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** What the plan left out and what the AI looked at. */
export function PlanSources({ result }: { result: PlanResult }) {
  const { skipped, trends, grounding } = result;
  return (
    <div className="space-y-3">
      {skipped.length > 0 && (
        <Disclosure tone="warning" summary={`We left out ${skipped.length} ${skipped.length === 1 ? "idea" : "ideas"}`}>
          <ul className="list-disc space-y-1 pl-5 text-xs">
            {skipped.map((s) => <li key={s}>{s}</li>)}
          </ul>
        </Disclosure>
      )}
      {trends && (
        <Disclosure summary="Trends the AI looked at">
          <TrendGroups snapshot={trends} limit={10} />
        </Disclosure>
      )}
      {grounding && (
        <Disclosure summary="What the AI searched for">
          <SearchSuggestions grounding={grounding} />
        </Disclosure>
      )}
    </div>
  );
}
