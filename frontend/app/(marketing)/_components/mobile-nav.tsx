"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { LuMenu, LuX } from "react-icons/lu";
import { cn, focusRing } from "@/app/components/ui";
import { useDismiss } from "@/app/lib/hooks/use-dismiss";
import { NAV_LINKS } from "./content";
import { PillButton } from "./pill-button";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss<HTMLDivElement>(open, close);
  return (
    <div ref={ref} className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label={open ? "Close menu" : "Open menu"}
        className={cn("flex h-11 w-11 items-center justify-center rounded-md text-foreground hover:bg-muted", focusRing)}
      >
        {open ? <LuX className="h-5 w-5" /> : <LuMenu className="h-5 w-5" />}
      </button>
      {open && (
        <nav id="mobile-nav" aria-label="Site" className="absolute inset-x-0 top-16 border-b border-border bg-background px-4 pb-6 pt-2 shadow-md">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={close} className={cn("flex min-h-12 items-center rounded-md px-3 text-base font-medium text-foreground hover:bg-muted", focusRing)}>
              {l.label}
            </a>
          ))}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <PillButton href="/signin" variant="outline" onClick={close}>Log in</PillButton>
            <PillButton href="/signup" onClick={close}>Get started</PillButton>
          </div>
        </nav>
      )}
    </div>
  );
}

export function NavAnchors() {
  return (
    <nav aria-label="Site" className="hidden items-center gap-1 md:flex">
      {NAV_LINKS.map((l) => (
        <Link key={l.href} href={l.href} className={cn("rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground", focusRing)}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
