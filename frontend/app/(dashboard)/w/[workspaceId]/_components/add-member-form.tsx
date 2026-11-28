"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { LuUserPlus } from "react-icons/lu";
import { Button, Field, Input, Select } from "@/app/components/ui";
import { api } from "@/app/lib/api/client";
import type { WorkspaceRole } from "@/app/lib/api/types";
import { FormError, submitWithErrors } from "@/app/lib/forms";
import { memberSchema, type MemberValues } from "@/app/lib/validation/schemas";
import { useWorkspace } from "./workspace-context";

export const ROLES: { value: WorkspaceRole; label: string; help: string }[] = [
  { value: "viewer", label: "Viewer", help: "Sees the feed, calendar and analytics" },
  { value: "editor", label: "Editor", help: "Creates, schedules and publishes posts" },
  { value: "admin", label: "Admin", help: "Connects accounts and manages members" },
  { value: "owner", label: "Owner", help: "Everything, including deleting the workspace" },
];

/** Roles the current member may hand out: up to and including their own. */
export function useGrantableRoles() {
  const { can } = useWorkspace();
  return ROLES.filter((r) => can(r.value));
}

export function AddMemberForm({ onAdded }: { onAdded: () => void }) {
  const { base } = useWorkspace();
  const roles = useGrantableRoles();
  const form = useForm<MemberValues>({ resolver: zodResolver(memberSchema), defaultValues: { email: "", role: "editor" } });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = submitWithErrors(form, async (values) => {
    await api(`${base}/members`, { body: values });
    form.reset();
    onAdded();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3 border-b border-border p-5">
      <div className="grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-start">
        <Field label="Add by email" hint="They need to sign up for Aby Socials first." error={errors.email?.message}>
          <Input type="email" placeholder="teammate@example.com" aria-invalid={Boolean(errors.email)} {...form.register("email")} />
        </Field>
        <Field label="Role">
          <Select {...form.register("role")}>{roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</Select>
        </Field>
        <Button type="submit" loading={isSubmitting} className="sm:mt-[26px]"><LuUserPlus className="h-4 w-4" aria-hidden /> Add member</Button>
      </div>
      <FormError form={form} />
    </form>
  );
}
