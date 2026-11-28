"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useSWRConfig } from "swr";
import { Button, Card, CardHeader, Field, Input } from "@/app/components/ui";
import { api } from "@/app/lib/api/client";
import { FormError, submitWithErrors } from "@/app/lib/forms";
import { workspaceSchema, type WorkspaceValues } from "@/app/lib/validation/schemas";
import { useWorkspace } from "./workspace-context";

export function WorkspaceCard() {
  const { base, workspace, can } = useWorkspace();
  const { mutate } = useSWRConfig();
  const form = useForm<WorkspaceValues>({
    resolver: zodResolver(workspaceSchema),
    values: { name: workspace?.name ?? "" },
  });
  const { errors, isSubmitting, isDirty } = form.formState;

  const onSubmit = submitWithErrors(form, async ({ name }) => {
    await api(base, { method: "PATCH", body: { name } });
    await mutate("/me");
  });

  return (
    <Card className="h-fit">
      <CardHeader title="Workspace" />
      <form onSubmit={onSubmit} noValidate className="space-y-4 p-5">
        <Field label="Name" error={errors.name?.message}>
          <Input disabled={!can("admin")} aria-invalid={Boolean(errors.name)} {...form.register("name")} />
        </Field>
        <FormError form={form} />
        {can("admin") && <Button type="submit" variant="outline" loading={isSubmitting} disabled={!isDirty}>Save changes</Button>}
      </form>
    </Card>
  );
}
