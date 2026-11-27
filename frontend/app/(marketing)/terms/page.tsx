import { publicPageMetadata } from "@/app/lib/seo";
import Link from "next/link";
import { SITE } from "@/app/lib/site";
import { LEGAL } from "../_components/legal/legal-config";
import { LegalDocument, type LegalSection } from "../_components/legal/legal-document";

export const metadata = publicPageMetadata({
  title: "Terms of Service",
  description: `The terms that apply when you use ${LEGAL.product}.`,
  path: "/terms",
});

const sections: LegalSection[] = [
  {
    id: "agreement",
    title: "Agreement",
    body: (
      <p>
        {LEGAL.product} is owned and operated by {LEGAL.legalEntity} (&ldquo;we&rdquo;, &ldquo;us&rdquo;). These terms are an
        agreement between you and {LEGAL.legalEntity} for the use of {LEGAL.product}, including the website at{" "}
        <a href={SITE.url}>{SITE.domain}</a>. By creating an account or using the service, you accept them. If you use {LEGAL.product} for an
        organisation, you confirm that you can accept them on its behalf.
      </p>
    ),
  },
  {
    id: "eligibility",
    title: "Eligibility and accounts",
    body: (
      <ul>
        <li>You must be at least {LEGAL.minimumAge}, and old enough to agree to these terms where you live.</li>
        <li>Give us accurate information, and keep your password safe. You are responsible for activity under your account.</li>
        <li>Tell us straight away at <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a> if you suspect unauthorised access.</li>
      </ul>
    ),
  },
  {
    id: "workspaces",
    title: "Workspaces and teams",
    body: (
      <p>
        Workspace owners decide who joins and what role they have. Owners and admins are responsible for the accounts they
        connect and for the people they invite. Members can see and act on that workspace&apos;s content according to their role.
      </p>
    ),
  },
  {
    id: "connected-accounts",
    title: "Connecting social accounts",
    body: (
      <>
        <p>
          When you connect an account, you authorise {LEGAL.product} to act for it as you direct: publishing your posts, reading
          its profile and reading engagement on posts we published. You must have the right to connect each account, and you
          must follow each platform&apos;s own terms and rules, including its automation and spam policies.
        </p>
        <p>
          {LEGAL.product} is independent and is not affiliated with, endorsed by or sponsored by any of the platforms it works
          with. Platforms can change or withdraw their APIs at any time, which can limit what we can offer.
        </p>
      </>
    ),
  },
  {
    id: "your-content",
    title: "Your content",
    body: (
      <p>
        You keep ownership of everything you create or upload. You give us a limited licence to host, copy, process, adapt (for
        example to fit a platform&apos;s character limit) and transmit your content, only to provide the service as you direct.
        You are responsible for your content and for having the rights to publish it.
      </p>
    ),
  },
  {
    id: "ai",
    title: "AI features",
    body: (
      <p>
        AI-generated drafts can be inaccurate, incomplete or unsuitable. Review them before you approve them. AI plans are saved
        as drafts, and nothing they contain is published until you schedule or publish it. You are responsible for anything you
        choose to publish.
      </p>
    ),
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    body: (
      <>
        <p>You must not use {LEGAL.product} to:</p>
        <ul>
          <li>publish spam, scams, malware, or deceptive or illegal content;</li>
          <li>harass, threaten or impersonate anyone, or violate anyone&apos;s rights, including privacy and intellectual property;</li>
          <li>manipulate platforms, for example with fake engagement, coordinated inauthentic behaviour or ban evasion;</li>
          <li>break any platform&apos;s terms or rate limits, or access accounts you are not authorised to use;</li>
          <li>probe, scan or test our systems without our written permission, interfere with the service, or reverse engineer it except where the law allows.</li>
        </ul>
      </>
    ),
  },
  {
    id: "fees",
    title: "Fees",
    body: <p>{LEGAL.product} is currently free. If we introduce paid plans, we will tell you the price and terms in advance, and you will not be charged unless you choose a paid plan.</p>,
  },
  {
    id: "availability",
    title: "Availability and changes",
    body: <p>We work to keep {LEGAL.product} reliable, but it is provided without guaranteed uptime. Scheduled posts can be delayed or fail if a platform is unavailable or rejects them. We may change, add or remove features.</p>,
  },
  {
    id: "termination",
    title: "Ending your use",
    body: (
      <p>
        You can stop using {LEGAL.product} and delete your account at any time from <Link href="/me">your profile</Link>. We may
        suspend or close accounts that break these terms or put the service or others at risk, and will tell you why unless the
        law or safety prevents it.
      </p>
    ),
  },
  {
    id: "disclaimers",
    title: "Disclaimers",
    body: <p>To the extent the law allows, {LEGAL.product} is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;, without warranties of any kind, including fitness for a particular purpose, and without any guarantee of reach, engagement or results.</p>,
  },
  {
    id: "liability",
    title: "Limitation of liability",
    body: (
      <p>
        To the extent the law allows, we are not liable for indirect or consequential losses, or for lost profits, data or
        goodwill. Our total liability for any claim relating to the service is limited to the greater of the amount you paid us
        in the 12 months before the claim or 100 US dollars. Nothing here limits liability that cannot be limited by law.
      </p>
    ),
  },
  {
    id: "indemnity",
    title: "Indemnity",
    body: <p>You agree to cover our reasonable costs from claims caused by your content or your breach of these terms or of a platform&apos;s terms.</p>,
  },
  {
    id: "law",
    title: "Governing law",
    body: <p>These terms are governed by the laws of {LEGAL.governingLaw}. This does not remove any protection you have under the consumer laws of the country where you live.</p>,
  },
  {
    id: "changes",
    title: "Changes to these terms",
    body: <p>If we make material changes, we will update the effective date above and tell you before they take effect. If you keep using {LEGAL.product} after that, you accept the new terms.</p>,
  },
  {
    id: "contact",
    title: "Contact",
    body: <p>{LEGAL.legalEntity}, {LEGAL.address}. Email: <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>.</p>,
  },
];

export default function TermsPage() {
  return (
    <LegalDocument
      title="Terms of Service"
      current="/terms"
      intro={<p>Please read these terms carefully. They explain your rights and responsibilities when you use {LEGAL.product}, together with our <Link href="/privacy">Privacy Policy</Link>.</p>}
      sections={sections}
    />
  );
}
