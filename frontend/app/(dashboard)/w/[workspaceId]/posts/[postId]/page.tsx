import type { Metadata } from "next";
import { PostView } from "../../_components/post-view";

export const metadata: Metadata = { title: "Post" };

export default function Page() {
  return <PostView />;
}
