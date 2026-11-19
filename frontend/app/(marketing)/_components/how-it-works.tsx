"use client";

import Image from "next/image";
import { useEffect, useState, useSyncExternalStore } from "react";
import { LuPause, LuPlay } from "react-icons/lu";
import { cn, focusRing } from "@/app/components/ui";
import { SCREENS } from "./content";

const STEPS = [
  { title: "Connect your accounts", body: "Add Bluesky, Mastodon, Telegram or Discord in a minute. Credentials are verified and stored encrypted.", screen: SCREENS.accounts },
  { title: "Write once, or let AI plan", body: "Draft a post and tune it for each platform, or give the agent a brief and get a calendar of drafts.", screen: SCREENS.create },
  { title: "Approve and schedule", body: "Review the week at a glance. Approved posts go out on time, with retries if a platform hiccups.", screen: SCREENS.calendar },
  { title: "See what works", body: "Likes, reposts and replies roll in every 15 minutes, per post and per account, all in one place.", screen: SCREENS.analytics },
];

const ADVANCE_MS = 6000;
const REDUCED = "(prefers-reduced-motion: reduce)";

function subscribeReduced(onChange: () => void) {
  const query = matchMedia(REDUCED);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

// Server renders as "motion allowed"; the client corrects it before autoplay starts.
const usePrefersReducedMotion = () =>
  useSyncExternalStore(subscribeReduced, () => matchMedia(REDUCED).matches, () => false);

export function HowItWorks() {
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [hovering, setHovering] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const autoplay = playing && !reducedMotion;

  useEffect(() => {
    if (!autoplay || hovering) return;
    const id = setInterval(() => setActive((i) => (i + 1) % STEPS.length), ADVANCE_MS);
    return () => clearInterval(id);
  }, [autoplay, hovering]);

  return (
    <section id="how-it-works" aria-labelledby="how-heading" className="scroll-mt-16 py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)} onFocus={() => setHovering(true)} onBlur={() => setHovering(false)}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="section-label">How it works</p>
            <h2 id="how-heading" className="mt-3 text-3xl font-bold tracking-tight text-foreground md:text-4xl">From blank page to results in four steps</h2>
          </div>
          {!reducedMotion && (
            <button type="button" onClick={() => setPlaying((p) => !p)} className={cn("inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-4 text-sm font-medium text-foreground hover:bg-muted", focusRing)}>
              {playing ? <LuPause className="h-4 w-4" aria-hidden /> : <LuPlay className="h-4 w-4" aria-hidden />}
              {playing ? "Pause" : "Play"}
            </button>
          )}
        </div>

        <div className="mt-12 grid items-center gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div role="tablist" aria-label="Steps" className="space-y-3">
            {STEPS.map((step, i) => (
              <button
                key={step.title}
                role="tab"
                id={`step-tab-${i}`}
                aria-selected={active === i}
                aria-controls="step-panel"
                onClick={() => setActive(i)}
                className={cn(
                  "w-full rounded-lg border p-5 text-left transition-all duration-300 motion-reduce:transition-none",
                  focusRing,
                  active === i ? "scale-100 border-primary bg-card opacity-100 shadow-md" : "scale-[0.98] border-transparent opacity-60 hover:opacity-80",
                )}
              >
                <span className="flex items-center gap-3">
                  <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold", active === i ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{i + 1}</span>
                  <span className="text-base font-bold text-foreground">{step.title}</span>
                </span>
                <span className="mt-2 block pl-11 text-sm leading-6 text-muted-foreground">{step.body}</span>
              </button>
            ))}
            <div aria-hidden className="flex gap-2 pl-1 pt-2">
              {STEPS.map((s, i) => <span key={s.title} className={cn("h-2 rounded-full transition-all duration-300", active === i ? "gradient-brand w-8" : "w-2 bg-border")} />)}
            </div>
          </div>

          <div id="step-panel" role="tabpanel" aria-labelledby={`step-tab-${active}`} className="relative">
            <div aria-hidden className="pointer-events-none absolute inset-0 rounded-full bg-primary/15 blur-3xl" />
            <div className="relative overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
              <div className="relative aspect-[16/10]">
                {STEPS.map((step, i) => (
                  <Image key={step.title} src={step.screen.src} alt={active === i ? step.screen.alt : ""} fill sizes="(min-width: 1024px) 60vw, 100vw" className={cn("object-cover object-top transition-opacity duration-500 motion-reduce:transition-none", active === i ? "opacity-100" : "opacity-0")} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
