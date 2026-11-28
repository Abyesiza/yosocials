import type { IconType } from "react-icons";
import { LuCalendarDays, LuChartColumn, LuImage, LuLayoutGrid, LuMegaphone, LuPenLine, LuShieldCheck, LuSparkles, LuTrendingUp } from "react-icons/lu";
import { Badge } from "@/app/components/ui";

const FEATURES: { Icon: IconType; title: string; body: string; soon?: boolean }[] = [
  { Icon: LuSparkles, title: "Plan with AI", body: "Describe a goal and get a week of drafts timed for your audience. Nothing posts until you approve it." },
  { Icon: LuPenLine, title: "Write once, tune per platform", body: "One idea, a version for each account, with that platform’s real character limit counted as you type." },
  { Icon: LuLayoutGrid, title: "One feed for everything", body: "Every post you publish, across every account, in a single Instagram-style feed with its likes and replies." },
  { Icon: LuChartColumn, title: "Analytics that move", body: "We record engagement through the day, so you see how a post grows, not just where it ended up." },
  { Icon: LuCalendarDays, title: "Reliable scheduling", body: "Posts go out on time, retry if a platform is briefly down, and never post twice." },
  { Icon: LuShieldCheck, title: "Teams and roles", body: "Workspaces per brand or client, with owner, admin, editor and viewer roles. Connected accounts are stored encrypted." },
  { Icon: LuTrendingUp, title: "Trend spotting", body: "Trending topics and formats matched to your niche, with ready-to-approve drafts.", soon: true },
  { Icon: LuImage, title: "Image and video posts", body: "Upload media once and let each platform get the right format and size.", soon: true },
  { Icon: LuMegaphone, title: "Ad boost", body: "Promote your best organic posts with budgets and rules you set.", soon: true },
];

export function Features() {
  return (
    <section id="features" aria-labelledby="features-heading" className="scroll-mt-20 bg-muted/50 py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="section-label">Features</p>
        <h2 id="features-heading" className="mt-3 text-3xl font-bold tracking-tight text-foreground md:text-4xl">Everything between the idea and the insight</h2>
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ Icon, title, body, soon }) => (
            <article key={title} className="relative overflow-hidden rounded-lg border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
              <span aria-hidden className="gradient-brand absolute inset-x-0 top-0 h-0.5 opacity-70" />
              <div className="flex items-start justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-primary"><Icon aria-hidden className="h-5 w-5" /></span>
                {soon && <Badge variant="outline">Coming soon</Badge>}
              </div>
              <h3 className="mt-5 text-lg font-bold text-foreground">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
