"use client";

import Link from "next/link";
import { LuPlus } from "react-icons/lu";
import { Avatar, Card, CardHeader, cn, focusRing, PageHeader } from "@/app/components/ui";
import { FormSkeleton, PageHeaderSkeleton } from "@/app/components/skeletons";
import { useApi } from "@/app/lib/api/client";
import type { Me } from "@/app/lib/api/types";
import { DeleteAccountForm } from "./delete-account-form";
import { PasswordForm } from "./password-form";
import { ProfileForm } from "./profile-form";

export function ProfileView() {
  const { data: me } = useApi<Me>("/me");
  if (!me) return <><PageHeaderSkeleton /><FormSkeleton /></>;
  return (
    <div>
      <div className="mb-8 flex items-center gap-4">
        <Avatar name={me.user.name} size={64} ring />
        <PageHeader eyebrow="Account" title={me.user.name} subtitle={me.user.email} />
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <ProfileForm me={me} />
        <PasswordForm />
        <Card className="h-fit">
          <CardHeader title="Your workspaces" action={<Link href="/workspaces/new" className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"><LuPlus className="h-3.5 w-3.5" aria-hidden /> New</Link>} />
          <ul className="divide-y divide-border">
            {me.workspaces.map((w) => (
              <li key={w.id}>
                <Link href={`/w/${w.id}`} className={cn("flex min-h-11 items-center justify-between px-5 py-3 text-sm hover:bg-muted", focusRing)}>
                  <span className="font-semibold text-foreground">{w.name}</span>
                  <span className="capitalize text-muted-foreground">{w.role}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <div className="mt-6 max-w-xl">
        <DeleteAccountForm />
      </div>
    </div>
  );
}
