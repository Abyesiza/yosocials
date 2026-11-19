"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import LogoSpinner from "@/app/components/LogoSpinner";
import { useApi } from "@/app/lib/api/client";
import type { Me } from "@/app/lib/api/types";

export function WorkspaceRedirect() {
  const router = useRouter();
  const { data } = useApi<Me>("/me");
  useEffect(() => {
    if (data) router.replace(data.workspaces[0] ? `/w/${data.workspaces[0].id}` : "/workspaces/new");
  }, [data, router]);
  return (
    <div className="flex flex-1 items-center justify-center py-32">
      <LogoSpinner size={56} label="Opening your workspace" />
    </div>
  );
}
