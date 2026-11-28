"use client";

import dynamic from "next/dynamic";
import { LuPlus, LuSparkles } from "react-icons/lu";
import { ButtonLink, PageHeader } from "@/app/components/ui";
import { CalendarSkeleton } from "@/app/components/skeletons";
import { useWorkspace } from "./workspace-context";

// Client-only: the saved view, screen width and time zone are only known in the browser.
const ContentCalendar = dynamic(() => import("./content-calendar"), { ssr: false, loading: () => <CalendarSkeleton /> });

export function CalendarView() {
  const { href, can, loading } = useWorkspace();
  return (
    <div>
      <PageHeader
        eyebrow="Content calendar"
        title="Calendar"
        subtitle={`Drafts, scheduled and published posts across every account.${can("editor") ? " Drag a post to move it, or open it to change the time." : ""}`}
        actions={
          can("editor") && (
            <>
              <ButtonLink href={href("/create")} size="sm"><LuPlus className="h-4 w-4" aria-hidden /> Create post</ButtonLink>
              <ButtonLink href={href("/plan")} size="sm" variant="outline"><LuSparkles className="h-4 w-4" aria-hidden /> Plan with AI</ButtonLink>
            </>
          )
        }
      />
      {loading ? <CalendarSkeleton /> : <ContentCalendar />}
    </div>
  );
}
