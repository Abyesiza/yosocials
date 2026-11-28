import { LuBriefcase, LuStar, LuUser } from "react-icons/lu";

const PERSONAS = [
  { Icon: LuUser, title: "Individuals", body: "Keep a steady presence without living in five apps. Plan a week in minutes and get back to your day.", points: ["AI drafts in your voice", "One place to see what landed"] },
  { Icon: LuStar, title: "Creators", body: "Show up everywhere your audience is, with each platform getting a version that fits it.", points: ["Per-platform rewrites", "Engagement trends per post"] },
  { Icon: LuBriefcase, title: "Companies", body: "Give every brand or client its own workspace, and every teammate exactly the access they need.", points: ["Workspaces and roles", "Approve before anything posts"] },
];

export function PersonaGrids() {
  return (
    <section id="solutions" aria-labelledby="solutions-heading" className="hero-glow scroll-mt-16 py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#93c5fd]">Solutions</p>
        <h2 id="solutions-heading" className="mt-3 max-w-3xl text-3xl font-bold tracking-tight text-white md:text-4xl">Built for one account or a hundred</h2>
        <p className="mt-4 max-w-2xl text-zinc-300">Each account has a persona and brand voice, so AI writes like you, not like a template.</p>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {PERSONAS.map(({ Icon, title, body, points }) => (
            <article key={title} className="glass-card rounded-lg p-7">
              <span className="flex h-11 w-11 items-center justify-center rounded-md bg-white/10 text-white"><Icon aria-hidden className="h-5 w-5" /></span>
              <h3 className="mt-5 text-xl font-bold text-white">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-300">{body}</p>
              <ul className="mt-5 space-y-2 border-t border-white/10 pt-5 text-sm text-zinc-200">
                {points.map((p) => <li key={p} className="flex items-center gap-2"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brand-green" />{p}</li>)}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
