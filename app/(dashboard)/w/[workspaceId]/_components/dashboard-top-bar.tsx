"use client";

import Image from "next/image";
import { LuMenu, LuPlus } from "react-icons/lu";
import { ProfileMenu } from "@/app/components/profile-menu";
import { ButtonLink, cn, focusRing } from "@/app/components/ui";
import { toggleSidebar } from "./nav";
import { useWorkspace } from "./workspace-context";

export function DashboardTopBar() {
  const { href, can } = useWorkspace();
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur md:px-8">
      <button
        type="button"
        onClick={toggleSidebar}
        aria-label="Open menu"
        aria-controls="dashboard-sidebar"
        className={cn("flex h-11 w-11 items-center justify-center rounded-md hover:bg-muted md:hidden", focusRing)}
      >
        <LuMenu className="h-5 w-5" />
      </button>
      <Image src="/logo.png" alt="Yo Socials" width={500} height={500} className="h-7 w-7 md:hidden" />
      <div className="flex-1" />
      {can("editor") && (
        <ButtonLink href={href("/create")} size="sm">
          <LuPlus className="h-4 w-4" aria-hidden /> Create post
        </ButtonLink>
      )}
      <ProfileMenu />
    </header>
  );
}
