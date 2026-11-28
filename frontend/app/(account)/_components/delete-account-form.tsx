"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Button, Card, CardHeader, Field, Input } from "@/app/components/ui";
import { api } from "@/app/lib/api/client";
import { FormError, submitWithErrors } from "@/app/lib/forms";
import { deleteAccountSchema } from "@/app/lib/validation/schemas";

export function DeleteAccountForm() {
  const router = useRouter();
  const form = useForm<z.input<typeof deleteAccountSchema>, unknown, z.output<typeof deleteAccountSchema>>({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: { password: "", confirm: false },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = submitWithErrors(form, async ({ password }) => {
    await api("/me", { method: "DELETE", body: { password } });
    router.replace("/");
    router.refresh();
  });

  return (
    <Card className="h-fit border-destructive/40">
      <CardHeader title="Delete account" />
      <form onSubmit={onSubmit} noValidate className="space-y-4 p-5">
        <p className="text-sm text-muted-foreground">
          This permanently deletes your profile, logs you out on every device, and deletes every workspace where you’re the only
          member, with its connected accounts, posts and analytics. Posts already published stay on each platform.{" "}
          <Link href="/data-deletion" className="font-semibold text-primary hover:underline">What gets deleted</Link>
        </p>
        <Field label="Password" error={errors.password?.message}>
          <Input type="password" autoComplete="current-password" aria-invalid={Boolean(errors.password)} {...form.register("password")} />
        </Field>
        <label className="flex min-h-11 items-start gap-3 text-sm text-foreground">
          <input type="checkbox" className="mt-1 h-4 w-4 accent-[hsl(var(--destructive))]" {...form.register("confirm")} />
          I understand this can’t be undone.
        </label>
        {errors.confirm && <p role="alert" className="text-xs font-medium text-destructive">{errors.confirm.message}</p>}
        <FormError form={form} />
        <Button type="submit" variant="destructive" loading={isSubmitting}>Delete my account</Button>
      </form>
    </Card>
  );
}
