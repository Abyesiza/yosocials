"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { LuLogOut, LuMonitor, LuMoon, LuSun, LuUser } from "react-icons/lu";
import { authCall, useApi } from "@/app/lib/api/client";
import type { Me } from "@/app/lib/api/types";
import { useDismiss } from "@/app/lib/hooks/use-dismiss";
import { applyTheme, readTheme, type ThemePreference } from "@/app/lib/theme";
import { Avatar, cn, focusRing } from "./ui";

const THEMES: { value: ThemePreference; label: string; Icon: typeof LuSun }[] = [
  { value: "light", label: "Light", Icon: LuSun },
  { value: "dark", label: "Dark", Icon: LuMoon },
  { value: "system", label: "System", Icon: LuMonitor },
];

export function ProfileMenu() {
  const { data: me } = useApi<Me>("/me");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<ThemePreference>("light");
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss<HTMLDivElement>(open, close);

  function toggle() {
    if (!open) setTheme(readTheme());
    setOpen((o) => !o);
  }

  async function signOut() {
    await authCall("signout");
    router.replace("/signin");
    router.refresh();
  }

  const item = cn("flex min-h-11 w-full items-center gap-2 rounded-md px-3 text-left text-sm text-foreground hover:bg-muted", focusRing);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Profile menu"
        className={cn("flex h-11 w-11 items-center justify-center rounded-full", focusRing)}
      >
        <Avatar name={me?.user.name ?? "?"} size={36} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-64 rounded-md border border-border bg-card p-1 shadow-md">
          {me && (
            <div className="border-b border-border px-3 py-2">
              <p className="truncate text-sm font-semibold text-foreground">{me.user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{me.user.email}</p>
            </div>
          )}
          <Link role="menuitem" href="/me" onClick={close} className={cn(item, "mt-1")}>
            <LuUser className="h-4 w-4" aria-hidden /> Profile & password
          </Link>
          <div role="group" aria-label="Theme" className="my-1 grid grid-cols-3 gap-1 px-1">
            {THEMES.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                aria-pressed={theme === value}
                onClick={() => {
                  applyTheme(value);
                  setTheme(value);
                }}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-md text-xs",
                  focusRing,
                  theme === value ? "bg-primary/10 font-semibold text-primary" : "text-muted-foreground hover:bg-muted",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden /> {label}
              </button>
            ))}
          </div>
          <button role="menuitem" type="button" onClick={signOut} className={cn(item, "border-t border-border")}>
            <LuLogOut className="h-4 w-4" aria-hidden /> Log out
          </button>
        </div>
      )}
    </div>
  );
}
