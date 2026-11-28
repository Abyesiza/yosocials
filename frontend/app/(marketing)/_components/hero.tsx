import { platforms } from "@/app/lib/platforms";
import { LIVE_PLATFORMS, SCREENS } from "./content";
import { MockDevice } from "./mock-device";
import { PillButton } from "./pill-button";

export function Hero() {
  return (
    <section className="hero-glow relative overflow-hidden">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 pb-20 pt-16 sm:px-6 md:pt-24 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:px-8 lg:pb-28">
        <div className="step-text-in">
          <p className="text-sm font-semibold uppercase tracking-wider text-[#93c5fd]">Social media, planned with AI</p>
          <h1 className="mt-4 text-4xl font-bold leading-[1.08] tracking-tight text-white md:text-6xl lg:text-7xl">
            Plan, post and grow on <span className="gradient-text">every platform</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-300">
            Aby Socials drafts a content calendar for each of your accounts, publishes on time and shows how every post performs. One home for every account you run.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <PillButton href="/signup" className="h-12 px-7 text-base">Get started free</PillButton>
            <PillButton href="#how-it-works" variant="ghost" className="h-12 px-7 text-base">See how it works</PillButton>
          </div>
          <div className="mt-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Works today with</p>
            <ul className="mt-3 flex flex-wrap items-center gap-4">
              {LIVE_PLATFORMS.map((key) => {
                const { Icon, label, color } = platforms[key];
                return (
                  <li key={key} className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                    <Icon aria-hidden className="h-5 w-5" style={{ color }} /> {label}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
        <div className="relative sm:mb-12">
          <div aria-hidden className="pointer-events-none absolute inset-0 rounded-full bg-primary/20 blur-3xl" />
          <MockDevice kind="browser" priority {...SCREENS.feed} />
          <div className="absolute -bottom-12 -right-2 hidden w-[28%] sm:block lg:-right-6">
            <MockDevice kind="phone" priority {...SCREENS.phone} sizes="(min-width: 1024px) 300px, 30vw" />
          </div>
        </div>
      </div>
    </section>
  );
}
