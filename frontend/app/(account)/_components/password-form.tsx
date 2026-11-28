"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button, Card, CardHeader, Field, Input } from "@/app/components/ui";
import { api } from "@/app/lib/api/client";
import { FormError, submitWithErrors } from "@/app/lib/forms";
import { passwordSchema, type PasswordValues } from "@/app/lib/validation/schemas";

export function PasswordForm() {
  const [changed, setChanged] = useState(false);
  const form = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema), defaultValues: { currentPassword: "", newPassword: "" } });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = submitWithErrors(form, async (values) => {
    setChanged(false);
    await api("/me/password", { body: values });
    form.reset();
    setChanged(true);
  });

  return (
    <Card>
      <CardHeader title="Password" />
      <form onSubmit={onSubmit} noValidate className="space-y-4 p-5">
        <Field label="Current password" error={errors.currentPassword?.message}>
          <Input type="password" autoComplete="current-password" aria-invalid={Boolean(errors.currentPassword)} {...form.register("currentPassword")} />
        </Field>
        <Field label="New password" hint="At least 8 characters. We’ll log you out on your other devices." error={errors.newPassword?.message}>
          <Input type="password" autoComplete="new-password" aria-invalid={Boolean(errors.newPassword)} {...form.register("newPassword")} />
        </Field>
        <FormError form={form} />
        <div className="flex items-center gap-3">
          <Button type="submit" variant="outline" loading={isSubmitting}>Change password</Button>
          {changed && <span role="status" className="text-sm text-success">Password changed. Your other devices are logged out.</span>}
        </div>
      </form>
    </Card>
  );
}
