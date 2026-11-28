"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button, Card, CardHeader, Field, Input } from "@/app/components/ui";
import { api, useApi } from "@/app/lib/api/client";
import type { Me, User } from "@/app/lib/api/types";
import { FormError, submitWithErrors } from "@/app/lib/forms";
import { profileSchema, type ProfileValues } from "@/app/lib/validation/schemas";

export function ProfileForm({ me }: { me: Me }) {
  const { mutate } = useApi<Me>("/me");
  const form = useForm<ProfileValues>({ resolver: zodResolver(profileSchema), values: { name: me.user.name } });
  const { errors, isSubmitting, isDirty, isSubmitSuccessful } = form.formState;

  const onSubmit = submitWithErrors(form, async (values) => {
    const user = await api<User>("/me", { method: "PATCH", body: values });
    await mutate({ ...me, user });
  });

  return (
    <Card>
      <CardHeader title="Profile" />
      <form onSubmit={onSubmit} noValidate className="space-y-4 p-5">
        <Field label="Name" error={errors.name?.message}>
          <Input autoComplete="name" aria-invalid={Boolean(errors.name)} {...form.register("name")} />
        </Field>
        <Field label="Email" hint="You can’t change your email yet.">
          <Input value={me.user.email} disabled readOnly />
        </Field>
        <FormError form={form} />
        <div className="flex items-center gap-3">
          <Button type="submit" variant="outline" loading={isSubmitting} disabled={!isDirty}>Save changes</Button>
          {isSubmitSuccessful && !isDirty && <span role="status" className="text-sm text-success">Changes saved</span>}
        </div>
      </form>
    </Card>
  );
}
