"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { LuSparkles } from "react-icons/lu";
import { Button, ButtonLink, Card, EmptyState, PageHeader } from "@/app/components/ui";
import { FormSkeleton } from "@/app/components/skeletons";
import { api, useApi } from "@/app/lib/api/client";
import type { Account, AgentCapabilities, PlanResult, PlatformInfo } from "@/app/lib/api/types";
import { startOfDayIn, suggestedZone } from "@/app/lib/audience";
import { FormError, submitWithErrors } from "@/app/lib/forms";
import { planSchema } from "@/app/lib/validation/schemas";
import type { Audience } from "./audience-fields";
import { AudienceNudge } from "./audience-nudge";
import { todayIn } from "./calendar-utils";
import { PlanFormFields, type PlanToggles } from "./plan-form-fields";
import { PlanResults } from "./plan-results";
import { RoleGate } from "./role-gate";
import { TrendsPanel } from "./trends-panel";
import { useWorkspace } from "./workspace-context";

export function PlanView() {
  return (
    <RoleGate role="editor" skeleton={<FormSkeleton fields={4} />}>
      <Planner />
    </RoleGate>
  );
}

function Planner() {
  const { base, href, can, workspace } = useWorkspace();
  const { data: accounts } = useApi<Account[]>(`${base}/accounts`);
  const { data: caps } = useApi<PlatformInfo[]>("/integrations");
  const { data: ai } = useApi<AgentCapabilities>(`${base}/agent/capabilities`, { revalidateOnFocus: false });
  const [selected, setSelected] = useState<string[] | null>(null);
  const [audience, setAudience] = useState<Audience>(() => {
    const country = workspace?.audienceCountry ?? "";
    return { country, timeZone: workspace?.audienceTimeZone ?? suggestedZone(country) };
  });
  const [toggles, setToggles] = useState<PlanToggles>({ useTrends: true, searchWeb: false });
  const [result, setResult] = useState<PlanResult | null>(null);

  const form = useForm<z.input<typeof planSchema>, unknown, z.output<typeof planSchema>>({
    resolver: zodResolver(planSchema),
    defaultValues: { brief: "", startDate: todayIn(audience.timeZone), days: 7, postsPerWeekPerAccount: 4 },
  });

  if (!accounts) return <FormSkeleton fields={4} />;
  if (accounts.length === 0) {
    return (
      <EmptyState
        title="Connect an account first"
        body="AI plans posts for the accounts connected to this workspace."
        action={can("admin") && <ButtonLink href={href("/accounts")}>Connect an account</ButtonLink>}
      />
    );
  }
  const chosen = selected ?? accounts.map((a) => a.id);
  const zone = audience.timeZone;

  const onSubmit = submitWithErrors(form, async (values) => {
    setResult(null);
    const plan = await api<PlanResult>(`${base}/agent/plan`, {
      body: {
        ...values,
        accountIds: chosen,
        startDate: startOfDayIn(values.startDate, zone),
        timezone: zone,
        ...(audience.country && { country: audience.country }),
        useTrends: toggles.useTrends,
        searchWeb: Boolean(ai?.searchWeb && toggles.searchWeb),
      },
    });
    setResult(plan);
  });

  const addToBrief = (term: string) => {
    const brief = form.getValues("brief").trim();
    form.setValue("brief", `${brief}${brief ? "\n" : ""}Trending now: ${term}`, { shouldDirty: true });
  };

  const { isSubmitting } = form.formState;
  return (
    <div>
      <AudienceNudge />
      <PageHeader eyebrow="AI" title="Plan with AI" subtitle="Describe your goal and AI drafts posts at the best times for each platform. Nothing is posted until you approve it." />
      <div className="grid gap-8 2xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="grid content-start gap-6 lg:grid-cols-2 2xl:grid-cols-1">
          <Card className="h-fit p-6">
            <form onSubmit={onSubmit} noValidate className="space-y-5">
              <PlanFormFields
                form={form}
                accounts={accounts}
                caps={caps ?? []}
                chosen={chosen}
                onChosen={setSelected}
                audience={audience}
                onAudience={setAudience}
                toggles={toggles}
                onToggles={setToggles}
                canSearchWeb={Boolean(ai?.searchWeb)}
              />
              <FormError form={form} />
              <Button type="submit" size="lg" loading={isSubmitting} disabled={chosen.length === 0}>
                <LuSparkles className="h-4 w-4" aria-hidden /> {isSubmitting ? "Planning…" : "Plan my posts"}
              </Button>
            </form>
          </Card>
          <TrendsPanel country={audience.country} onAdd={addToBrief} />
        </div>
        <section aria-label="Your plan">
          <PlanResults result={result} caps={caps ?? []} onPosts={(update) => setResult((r) => (r ? { ...r, posts: update(r.posts) } : r))} />
        </section>
      </div>
    </div>
  );
}
