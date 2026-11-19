import type { Metadata } from "next";
import { FeedView } from "./_components/feed-view";

export const metadata: Metadata = { title: "Home" };

export default function FeedPage() {
  return <FeedView />;
}
