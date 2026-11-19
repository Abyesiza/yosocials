import { LuCheck, LuX } from "react-icons/lu";

const PROBLEMS = [
  "Five apps open just to post one announcement",
  "Copy-pasting and re-trimming text for every character limit",
  "Numbers scattered across dashboards that never agree",
];

const VALUES = [
  "Write once and tune it per platform, with live limits",
  "An AI planner fills your week with drafts you approve",
  "One feed and one analytics view for every account",
];

export function ValueNarrative() {
  return (
    <section aria-labelledby="value-heading" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-28 lg:px-8">
      <p className="section-label">Why Yo Socials</p>
      <h2 id="value-heading" className="mt-3 max-w-3xl text-3xl font-bold tracking-tight text-foreground md:text-4xl">
        Social media shouldn&apos;t be a second job
      </h2>
      <div className="mt-12 grid gap-6 md:grid-cols-2">
        <List title="Without it" items={PROBLEMS} Icon={LuX} tone="text-destructive" />
        <List title="With Yo Socials" items={VALUES} Icon={LuCheck} tone="text-success" highlight />
      </div>
    </section>
  );
}

function List({ title, items, Icon, tone, highlight }: { title: string; items: string[]; Icon: typeof LuX; tone: string; highlight?: boolean }) {
  return (
    <div className={`relative overflow-hidden rounded-lg border border-border bg-card p-8 shadow-sm ${highlight ? "md:shadow-md" : ""}`}>
      {highlight && <span aria-hidden className="gradient-brand absolute inset-x-0 top-0 h-1" />}
      <h3 className="text-lg font-bold text-foreground">{title}</h3>
      <ul className="mt-5 space-y-4">
        {items.map((item) => (
          <li key={item} className="flex gap-3 text-base text-muted-foreground">
            <Icon aria-hidden className={`mt-1 h-4 w-4 shrink-0 ${tone}`} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
