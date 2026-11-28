import Link from "next/link";
import { SITE } from "@/app/lib/site";
import { BrandMark } from "./brand-mark";
import { NAV_LINKS } from "./content";

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-12 sm:px-6 md:flex-row md:items-start md:justify-between lg:px-8">
        <div className="max-w-xs space-y-3">
          <BrandMark />
          <p className="text-sm text-muted-foreground">AI that plans, publishes and tracks your social media.</p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm">
          {NAV_LINKS.map((l) => <a key={l.href} href={l.href} className="min-h-8 text-muted-foreground hover:text-foreground">{l.label}</a>)}
          <Link href="/signin" className="min-h-8 text-muted-foreground hover:text-foreground">Log in</Link>
          <Link href="/signup" className="min-h-8 text-muted-foreground hover:text-foreground">Sign up</Link>
        </nav>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:px-6 lg:px-8">
          <p>© <CopyrightYear /> {SITE.owner.name}. {SITE.name} is owned by {SITE.owner.name}. All rights reserved.</p>
          <nav aria-label="Legal" className="flex gap-4">
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/data-deletion" className="hover:text-foreground">Data deletion</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}

// Cached so the static shell can include it; the year only changes at rebuild.
async function CopyrightYear() {
  "use cache";
  return new Date().getFullYear();
}
