import type { Metadata } from "next";
import { PlanView } from "../_components/plan-view";

export const metadata: Metadata = { title: "Plan with AI" };

export default function Page() {
  return <PlanView />;
}
