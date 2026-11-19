"use client";

import type { FieldValues, UseFormReturn } from "react-hook-form";
import { ErrorNote } from "@/app/components/ui";

/** handleSubmit that turns a thrown API error into a form-level message. */
export function submitWithErrors<In extends FieldValues, Out = In>(
  form: UseFormReturn<In, unknown, Out>,
  action: (values: Out) => Promise<unknown>,
) {
  return form.handleSubmit(async (values) => {
    form.clearErrors("root");
    try {
      await action(values);
    } catch (error) {
      form.setError("root.server", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });
}

export function FormError<T extends FieldValues>({ form }: { form: UseFormReturn<T, unknown, unknown> }) {
  const message = form.formState.errors.root?.server?.message;
  return message ? <ErrorNote error={new Error(message)} /> : null;
}
