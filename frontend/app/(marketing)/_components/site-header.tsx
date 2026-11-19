import Link from "next/link";
import { cn, focusRing } from "@/app/components/ui";
import { BrandMark } from "./brand-mark";
import { MobileNav, NavAnchors } from "./mobile-nav";
import { PillButton } from "./pill-button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <BrandMark />
        <NavAnchors />
        <div className="hidden items-center gap-2 md:flex">
          <Link href="/signin" className={cn("rounded-md px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted", focusRing)}>Log in</Link>
          <PillButton href="/signup">Get started free</PillButton>
        </div>
        <MobileNav />
      </div>
    </header>
  );
}
