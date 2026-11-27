import { Suspense } from "react";
import { FeedSkeleton, PageHeaderSkeleton } from "@/app/components/skeletons";
import { PRIVATE_METADATA } from "@/app/lib/seo";
import { DashboardShell } from "./_components/dashboard-shell";

export const metadata = PRIVATE_METADATA;

export default function WorkspaceLayout({ children }: LayoutProps<"/w/[workspaceId]">) {
  return (
    <Suspense
      fallback={
        <div className="p-8 md:pl-72">
          <PageHeaderSkeleton />
          <FeedSkeleton />
        </div>
      }
    >
      <DashboardShell>{children}</DashboardShell>
    </Suspense>
  );
}
