"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Button, Field, Input } from "@/app/components/ui";
import { authCall } from "@/app/lib/api/client";
import { FormError, submitWithErrors } from "@/app/lib/forms";
import { signInSchema, signUpSchema } from "@/app/lib/validation/schemas";

// Only follow same-site relative paths, so ?next= can't send users elsewhere.
const safeNext = (next: string | null) =>
  next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

type SignUpInput = z.input<typeof signUpSchema>;

export function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const signup = mode === "signup";
  const form = useForm<SignUpInput, unknown, z.output<typeof signUpSchema>>({
    // Sign-in only validates the fields it renders.
    resolver: zodResolver((signup ? signUpSchema : signInSchema) as typeof signUpSchema),
    defaultValues: { name: "", email: "", password: "", workspaceName: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = submitWithErrors(form, async (values) => {
    await authCall(mode, values);
    router.replace(next);
    router.refresh();
  });

  const switchHref = `${signup ? "/signin" : "/signup"}${next !== "/dashboard" ? `?next=${encodeURIComponent(next)}` : ""}`;
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {signup && (
        <p className="pb-1 text-center text-sm font-medium text-muted-foreground">
          Sign up to plan, post and track every platform in one place.
        </p>
      )}
      {signup && (
        <Field label="Name" error={errors.name?.message}>
          <Input autoComplete="name" aria-invalid={Boolean(errors.name)} {...form.register("name")} />
        </Field>
      )}
      <Field label="Email" error={errors.email?.message}>
        <Input type="email" autoComplete="email" aria-invalid={Boolean(errors.email)} {...form.register("email")} />
      </Field>
      <Field label="Password" hint={signup ? "At least 8 characters." : undefined} error={errors.password?.message}>
        <Input type="password" autoComplete={signup ? "new-password" : "current-password"} aria-invalid={Boolean(errors.password)} {...form.register("password")} />
      </Field>
      {signup && (
        <Field label="Workspace name (optional)" hint="You can rename it later." error={errors.workspaceName?.message}>
          <Input placeholder="Acme Marketing" {...form.register("workspaceName")} />
        </Field>
      )}
      <FormError form={form} />
      {signup && (
        <p className="text-xs leading-5 text-muted-foreground">
          By signing up, you agree to our{" "}
          <Link href="/terms" className="font-medium text-primary hover:underline">Terms of Service</Link> and{" "}
          <Link href="/privacy" className="font-medium text-primary hover:underline">Privacy Policy</Link>.
        </p>
      )}
      <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
        {signup ? "Sign up" : "Log in"}
      </Button>
      <p className="pt-2 text-center text-sm text-muted-foreground">
        {signup ? "Have an account? " : "Don’t have an account? "}
        <Link href={switchHref} className="font-semibold text-primary hover:underline">
          {signup ? "Log in" : "Sign up"}
        </Link>
      </p>
    </form>
  );
}
