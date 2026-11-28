import { Badge, isNearBlack } from "@/app/components/ui";
import { platforms, type PlatformKey } from "@/app/lib/platforms";
import { LIVE_PLATFORMS } from "./content";

const ALL = Object.keys(platforms) as PlatformKey[];
const ORDERED = [...LIVE_PLATFORMS, ...ALL.filter((k) => !LIVE_PLATFORMS.includes(k))];

export function PlatformsSection() {
  return (
    <section id="platforms" aria-labelledby="platforms-heading" className="scroll-mt-16 bg-muted/50 py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="section-label">Platforms</p>
        <h2 id="platforms-heading" className="mt-3 text-3xl font-bold tracking-tight text-foreground md:text-4xl">Every platform, one workspace</h2>
        <p className="mt-4 max-w-2xl text-muted-foreground">{LIVE_PLATFORMS.length} platforms work today. The rest are on the way, built on each platform’s official API.</p>
        <ul className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {ORDERED.map((key) => {
            const { Icon, label, color } = platforms[key];
            const live = LIVE_PLATFORMS.includes(key);
            return (
              <li key={key} className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-sm">
                <Icon aria-hidden className="h-6 w-6 shrink-0" style={{ color: isNearBlack(color) ? undefined : color }} />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{label}</span>
                {live ? <Badge variant="success">Live</Badge> : <span className="text-xs text-muted-foreground">Soon</span>}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
