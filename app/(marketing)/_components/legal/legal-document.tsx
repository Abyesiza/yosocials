import Link from "next/link";
import type { ReactNode } from "react";
import { cn, focusRing } from "@/app/components/ui";
import { SiteFooter } from "../site-footer";
import { SiteHeader } from "../site-header";
import { hasPlaceholders, LEGAL } from "./legal-config";

export interface LegalSection {
  id: string;
  title: string;
  body: ReactNode;
}

const DOCS = [
  { href: "/terms", label: "Terms of Service" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/data-deletion", label: "Data deletion" },
];

/** Shared layout for the legal pages: title, effective date, contents and sections. */
export function LegalDocument({ title, intro, sections, current }: { title: string; intro: ReactNode; sections: LegalSection[]; current: string }) {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        {hasPlaceholders() && (
          <p role="note" className="border-b border-warning/30 bg-warning/10 px-4 py-3 text-center text-sm font-medium text-warning">
            Draft: company details in <code>legal-config.ts</code> still need filling in before this page is published.
          </p>
        )}
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:px-8 lg:py-20">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <nav aria-label="Legal documents" className="flex flex-wrap gap-2 lg:flex-col">
              {DOCS.map((d) => (
                <Link key={d.href} href={d.href} aria-current={d.href === current ? "page" : undefined} className={cn("rounded-md px-3 py-2 text-sm font-medium", focusRing, d.href === current ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                  {d.label}
                </Link>
              ))}
            </nav>
            <nav aria-label="On this page" className="mt-8 hidden lg:block">
              <p className="section-label mb-3">On this page</p>
              <ol className="space-y-2 text-sm">
                {sections.map((s, i) => (
                  <li key={s.id}><a href={`#${s.id}`} className="text-muted-foreground hover:text-foreground">{i + 1}. {s.title}</a></li>
                ))}
              </ol>
            </nav>
          </aside>
          <article className="max-w-3xl">
            <p className="section-label">Legal</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground md:text-4xl">{title}</h1>
            <p className="mt-3 text-sm text-muted-foreground">Effective {LEGAL.effectiveDate}</p>
            <div className="mt-8 space-y-4 text-base leading-7 text-muted-foreground">{intro}</div>
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className="scroll-mt-24 pt-10">
                <h2 id={`${s.id}-title`} className="text-xl font-bold tracking-tight text-foreground">{i + 1}. {s.title}</h2>
                <div className="mt-3 space-y-4 text-base leading-7 text-muted-foreground [&_a]:font-medium [&_a]:text-primary [&_a:hover]:underline [&_li]:pl-1 [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6">
                  {s.body}
                </div>
              </section>
            ))}
          </article>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

export function Ext({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
}
