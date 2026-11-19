"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { LuSparkles } from "react-icons/lu";
import { Button, ButtonLink, Card, EmptyState, ErrorNote, Field, Input, PageHeader, Select, Textarea } from "@/app/components/ui";
import { FormSkeleton } from "@/app/components/skeletons";
import { api, useApi } from "@/app/lib/api/client";
import type { Account, PlanResult } from "@/app/lib/api/types";
import { FormError, submitWithErrors } from "@/app/lib/forms";
import { planSchema } from "@/app/lib/validation/schemas";
import type { z } from "zod";
import { AccountPicker } from "./account-picker";
import { PlanResults } from "./plan-results";
import { RoleGate } from "./role-gate";
import { useWorkspace } from "./workspace-context";

const today = () => new Date().toISOString().slice(0, 10);

export function PlanView() {
  return (
    <RoleGate role="editor" skeleton={<FormSkeleton fields={4} />}>
      <Planner />
    </RoleGate>
  );
}

function Planner() {
  const { base, href } = useWorkspace();
  const { data: accounts } = useApi<Account[]>(`${base}/accounts`);
  const [selected, setSelected] = useState<string[] | null>(null);
  const [result, setResult] = useState<PlanResult | null>(null);
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<unknown>(null);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const form = useForm<z.input<typeof planSchema>, unknown, z.output<typeof planSchema>>({
    resolver: zodResolver(planSchema),
    defaultValues: { brief: "", startDate: today(), days: 7, postsPerWeekPerAccount: 4 },
  });

  if (!accounts) return <FormSkeleton fields={4} />;
  if (accounts.length === 0) {
    return <EmptyState title="Connect an account first" body="The agent writes for the accounts in this workspace." action={<ButtonLink href={href("/accounts")}>Connect an account</ButtonLink>} />;
  }
  const chosen = selected ?? accounts.map((a) => a.id);

  const onSubmit = submitWithErrors(form, async (values) => {
    setResult(null);
    setResult(
      await api<PlanResult>(`${base}/agent/plan`, {
        body: { ...values, accountIds: chosen, timezone, startDate: new Date(`${values.startDate}T00:00:00`).toISOString() },
      }),
    );
  });

  async function approveAll() {
    if (!result) return;
    setApproving(true);
    setApproveError(null);
    try {
      for (const post of result.posts) await api(`${base}/posts/${post.id}/schedule`, { method: "POST", body: {} });
      setResult({ ...result, posts: result.posts.map((p) => ({ ...p, status: "scheduled", targets: p.targets.map((t) => ({ ...t, status: "scheduled" })) })) });
    } catch (e) {
      setApproveError(e);
    } finally {
      setApproving(false);
    }
  }

  const { errors, isSubmitting } = form.formState;
  return (
    <div>
      <PageHeader eyebrow="AI agent" title="Plan with AI" subtitle="Describe the goal. The agent drafts a calendar for your accounts; nothing posts until you approve it." />
      <div className="grid gap-8 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card className="h-fit p-6">
          <form onSubmit={onSubmit} noValidate className="space-y-5">
            <Field label="Brief" hint="Goal, audience, offers, tone. The more specific, the better." error={errors.brief?.message}>
              <Textarea rows={6} aria-invalid={Boolean(errors.brief)} placeholder="Launch week for our budgeting app. Audience: young professionals in Kampala. Goal: waitlist sign-ups. Friendly, no jargon." {...form.register("brief")} />
            </Field>
            <AccountPicker accounts={accounts} selected={chosen} onChange={setSelected} label="Accounts" />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Start" error={errors.startDate?.message}>
                <Input type="date" min={today()} {...form.register("startDate")} />
              </Field>
              <Field label="Days">
                <Select {...form.register("days")}>{[3, 7, 14, 30].map((d) => <option key={d} value={d}>{d} days</option>)}</Select>
              </Field>
              <Field label="Posts / week / account">
                <Select {...form.register("postsPerWeekPerAccount")}>{[1, 2, 3, 4, 5, 7, 10, 14].map((n) => <option key={n} value={n}>{n}</option>)}</Select>
              </Field>
            </div>
            <p className="text-xs text-muted-foreground">Times are picked for your timezone ({timezone}).</p>
            <FormError form={form} />
            <Button type="submit" size="lg" loading={isSubmitting} disabled={chosen.length === 0}>
              <LuSparkles className="h-4 w-4" aria-hidden /> {isSubmitting ? "Planning…" : "Plan my calendar"}
            </Button>
          </form>
        </Card>
        <section aria-label="Drafts" aria-live="polite">
          <ErrorNote error={approveError} />
          <PlanResults result={result} approving={approving} onApproveAll={approveAll} />
        </section>
      </div>
    </div>
  );
}
