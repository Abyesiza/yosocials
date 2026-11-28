"use client";

import type { CalendarController } from "@fullcalendar/react";
import { LuChevronLeft, LuChevronRight, LuGlobe } from "react-icons/lu";
import LogoSpinner from "@/app/components/LogoSpinner";
import { Button } from "@/app/components/ui";
import { VIEWS, type ViewType } from "./calendar-utils";

export function CalendarToolbar({
  controller,
  view,
  onView,
  zone,
  loading,
}: {
  controller: CalendarController;
  view: ViewType;
  onView: (view: ViewType) => void;
  zone: string;
  loading: boolean;
}) {
  const buttons = controller.getButtonState();
  return (
    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => controller.prev()} disabled={buttons.prev.isDisabled} aria-label={buttons.prev.hint}>
          <LuChevronLeft className="h-4 w-4" aria-hidden />
        </Button>
        <Button variant="outline" size="sm" onClick={() => controller.today()} disabled={buttons.today.isDisabled}>
          Today
        </Button>
        <Button variant="outline" size="sm" onClick={() => controller.next()} disabled={buttons.next.isDisabled} aria-label={buttons.next.hint}>
          <LuChevronRight className="h-4 w-4" aria-hidden />
        </Button>
        <h2 className="ml-1 text-lg font-semibold text-foreground" aria-live="polite">{controller.view?.title}</h2>
        {loading && <LogoSpinner size={18} label="Loading posts" />}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <LuGlobe className="h-3.5 w-3.5" aria-hidden /> Times in {zone}
        </p>
        <div role="group" aria-label="Calendar view" className="flex flex-wrap gap-1 rounded-full border border-border p-1">
          {VIEWS.map((v) => (
            <Button key={v.type} size="sm" variant={view === v.type ? "primary" : "ghost"} aria-pressed={view === v.type} onClick={() => onView(v.type)}>
              {v.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
