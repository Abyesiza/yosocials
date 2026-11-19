"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useSWRConfig } from "swr";
import { Button, ButtonLink, Card, Field, Input } from "@/app/components/ui";
import { api } from "@/app/lib/api/client";
import type { Workspace } from "@/app/lib/api/types";
import { FormError, submitWithErrors } from "@/app/lib/forms";
import { workspaceSchema, type WorkspaceValues } from "@/app/lib/validation/schemas";

export function NewWorkspaceForm() {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const form = useForm<WorkspaceValues>({ resolver: zodResolver(workspaceSchema), defaultValues: { name: "" } });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = submitWithErrors(form, async (values) => {
    const ws = await api<Workspace>("/workspaces", { body: values });
    await mutate("/me");
    router.push(`/w/${ws.id}/accounts`);
  });

  return (
    <Card className="mx-auto mt-8 max-w-md p-8">
      <p className="section-label mb-2">Workspace</p>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">New workspace</h1>
      <p className="mt-1 text-sm text-muted-foreground">One per brand, client or team. Each has its own accounts, posts and members.</p>
      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
        <Field label="Name" error={errors.name?.message}>
          <Input placeholder="Acme Marketing" autoFocus aria-invalid={Boolean(errors.name)} {...form.register("name")} />
        </Field>
        <FormError form={form} />
        <div className="flex gap-2">
          <Button type="submit" loading={isSubmitting} className="flex-1">Create workspace</Button>
          <ButtonLink href="/dashboard" variant="ghost">Cancel</ButtonLink>
        </div>
      </form>
    </Card>
  );
}
