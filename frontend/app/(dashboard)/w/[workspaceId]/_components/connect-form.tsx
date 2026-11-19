"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Button, Card, Field, Input, PlatformIcon, platformLabel, Select, Textarea } from "@/app/components/ui";
import { api } from "@/app/lib/api/client";
import type { Platform } from "@/app/lib/api/types";
import { FormError, submitWithErrors } from "@/app/lib/forms";
import { connectSchema } from "@/app/lib/validation/schemas";
import { CREDENTIAL_FIELDS } from "./credential-fields";
import { useWorkspace } from "./workspace-context";

export function ConnectForm({ platform, onDone }: { platform: Platform; onDone: () => void }) {
  const { base } = useWorkspace();
  const spec = CREDENTIAL_FIELDS[platform];
  const form = useForm<z.input<typeof connectSchema>, unknown, z.output<typeof connectSchema>>({
    resolver: zodResolver(connectSchema),
    defaultValues: {
      credentials: Object.fromEntries(spec.fields.map((f) => [f.name, ""])),
      persona: "individual",
      voice: "",
    },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = submitWithErrors(form, async (values) => {
    await api(`${base}/accounts`, { body: { platform, ...values } });
    onDone();
  });

  return (
    <Card className="p-6">
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <div className="flex items-center gap-2">
          <PlatformIcon platform={platform} size={20} />
          <h3 className="font-semibold text-foreground">Connect {platformLabel(platform)}</h3>
        </div>
        <p className="text-sm text-muted-foreground">{spec.help}</p>
        <div className="grid gap-4 md:grid-cols-2">
          {spec.fields.map((f) => (
            <Field key={f.name} label={f.label} error={errors.credentials?.[f.name]?.message}>
              <Input
                type={f.secret ? "password" : "text"}
                placeholder={f.placeholder}
                autoComplete="off"
                aria-invalid={Boolean(errors.credentials?.[f.name])}
                {...form.register(`credentials.${f.name}`)}
              />
            </Field>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="This account is" hint="The AI writes differently for each.">
            <Select {...form.register("persona")}>
              <option value="individual">A person</option>
              <option value="influencer">A creator / influencer</option>
              <option value="company">A company or brand</option>
            </Select>
          </Field>
          <Field label="Brand voice (optional)" error={errors.voice?.message}>
            <Textarea rows={2} placeholder="Warm, concise, a little playful. No jargon." {...form.register("voice")} />
          </Field>
        </div>
        <p className="text-xs text-muted-foreground">We check these with {platformLabel(platform)} and store them encrypted.</p>
        <FormError form={form} />
        <Button type="submit" loading={isSubmitting}>Connect</Button>
      </form>
    </Card>
  );
}
