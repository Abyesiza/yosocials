"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { LuX } from "react-icons/lu";
import { cn, focusRing } from "@/app/components/ui";
import { isActive, NAV, TOGGLE_SIDEBAR } from "./nav";
import { useWorkspace } from "./workspace-context";
import { WorkspaceSwitcher } from "./workspace-switcher";

export function DashboardSidebar() {
  const { href, can, loading } = useWorkspace();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const toggle = () => setOpen((o) => !o);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener(TOGGLE_SIDEBAR, toggle);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(TOGGLE_SIDEBAR, toggle);
      window.removeEventListener("keydown", onKey);
    };
  }, [close]);

  // Role-gated items stay hidden until we know the role, so they never flash.
  const items = NAV.filter((item) => !item.role || (!loading && can(item.role)));

  return (
    <>
      {open && (
        <div aria-hidden className="fixed inset-0 z-30 bg-foreground/30 md:hidden" onClick={close} />
      )}
      <aside
        id="dashboard-sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 transform flex-col border-r border-border bg-card px-3 py-5 transition-transform duration-300 ease-in-out motion-reduce:transition-none md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mb-5 flex items-center justify-between px-2">
          <Link href={href()} onClick={close} className={cn("flex items-center gap-2 rounded-md", focusRing)}>
            <Image src="/logo.png" alt="" width={1024} height={1024} className="h-8 w-8" />
            <span className="text-lg font-bold tracking-tight text-foreground">Aby Socials</span>
          </Link>
          <button
            type="button"
            onClick={close}
            aria-label="Close menu"
            className={cn("flex h-11 w-11 items-center justify-center rounded-md hover:bg-muted md:hidden", focusRing)}
          >
            <LuX className="h-5 w-5" />
          </button>
        </div>

        <WorkspaceSwitcher />

        <nav aria-label="Workspace" className="mt-5 flex flex-1 flex-col gap-1">
          {items.map(({ label, path, Icon }) => {
            const target = href(path);
            const active = isActive(pathname, target, path === "");
            return (
              <Link
                key={label}
                href={target}
                onClick={close}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                  focusRing,
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-foreground hover:bg-primary/10",
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
