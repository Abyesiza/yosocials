import { PillButton } from "./pill-button";

export function ConversionCta() {
  return (
    <section aria-labelledby="cta-heading" className="px-4 py-20 sm:px-6 md:py-28 lg:px-8">
      <div className="hero-glow relative mx-auto max-w-7xl overflow-hidden rounded-lg px-6 py-16 text-center md:py-20">
        <h2 id="cta-heading" className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-white md:text-5xl">
          Your next week of posts, <span className="gradient-text">planned in minutes</span>
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg text-zinc-300">Create a workspace, connect an account and let the agent draft your first calendar.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <PillButton href="/signup" variant="light" className="h-12 px-8 text-base">Get started free</PillButton>
          <PillButton href="/signin" variant="ghost" className="h-12 px-8 text-base">Log in</PillButton>
        </div>
      </div>
    </section>
  );
}
