import type { Metadata } from "next";
import { CreateView } from "../_components/create-view";

export const metadata: Metadata = { title: "Create post" };

export default function Page() {
  return <CreateView />;
}
