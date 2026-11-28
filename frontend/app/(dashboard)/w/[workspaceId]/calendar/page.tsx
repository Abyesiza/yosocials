import type { Metadata } from "next";
import { AudienceNudge } from "../_components/audience-nudge";
import { CalendarView } from "../_components/calendar-view";

export const metadata: Metadata = { title: "Calendar" };

export default function Page() {
  return (
    <>
      <AudienceNudge />
      <CalendarView />
    </>
  );
}
