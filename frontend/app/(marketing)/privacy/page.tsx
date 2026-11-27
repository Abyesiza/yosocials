import { publicPageMetadata } from "@/app/lib/seo";
import Link from "next/link";
import { SITE } from "@/app/lib/site";
import { LEGAL, PLATFORM_POLICIES } from "../_components/legal/legal-config";
import { Ext, LegalDocument, type LegalSection } from "../_components/legal/legal-document";

export const metadata = publicPageMetadata({
  title: "Privacy Policy",
  description: `How ${LEGAL.product} collects, uses, protects and deletes your data.`,
  path: "/privacy",
});

const sections: LegalSection[] = [
  {
    id: "who-we-are",
    title: "Who we are",
    body: (
      <p>
        {LEGAL.product} ({SITE.domain}) is owned and operated by {LEGAL.legalEntity} (&ldquo;we&rdquo;, &ldquo;us&rdquo;). We are
        the controller of the personal data described here. Questions about privacy go to{" "}
        <a href={`mailto:${LEGAL.privacyEmail}`}>{LEGAL.privacyEmail}</a>.
      </p>
    ),
  },
  {
    id: "data-we-collect",
    title: "Data we collect",
    body: (
      <>
        <ul>
          <li><strong>Your account:</strong> name, email address, a hash of your password (never the password itself), and when you last signed in.</li>
          <li><strong>Workspaces:</strong> workspace names, who is a member, and each member&apos;s role.</li>
          <li><strong>Connected social accounts:</strong> the handle, display name, profile link, profile picture link and platform ID of each account you connect, plus the credentials you give us to act for it (for example an app password, access token, bot token or webhook URL) and any login session the platform issues.</li>
          <li><strong>Your content:</strong> posts, drafts, per-platform versions, schedules, briefs you give the AI planner, and each account&apos;s persona and brand-voice notes.</li>
          <li><strong>Performance data:</strong> public engagement counts (likes, reposts, replies, quotes) for posts you publish through {LEGAL.product}, collected for 30 days after publishing.</li>
          <li><strong>Technical data:</strong> session cookies and the basic request information our servers need to run and secure the service.</li>
        </ul>
        <p>We do not collect data from your social accounts beyond what is listed here, and we do not read your private messages.</p>
      </>
    ),
  },
  {
    id: "how-we-use-it",
    title: "How we use it",
    body: (
      <ul>
        <li>To provide the service: sign you in, publish posts when and where you tell us to, show your feed and calendar, and measure how posts perform.</li>
        <li>To generate drafts when you use the AI features.</li>
        <li>To keep the service secure, including rate limiting, detecting abuse and fixing errors.</li>
        <li>To contact you about your account or important changes.</li>
      </ul>
    ),
  },
  {
    id: "legal-bases",
    title: "Legal bases",
    body: (
      <p>
        Where data-protection law requires a legal basis, we rely on performing our contract with you (running the service you
        signed up for), our legitimate interests (keeping it secure and improving it), and your consent where we ask for it,
        which you can withdraw at any time.
      </p>
    ),
  },
  {
    id: "ai",
    title: "AI features",
    body: (
      <p>
        When you plan with AI or ask for per-platform versions, we send your brief or post text, together with the selected
        accounts&apos; platform, handle, persona and brand voice, to Google&apos;s Gemini API to generate drafts. Google
        processes this under the <Ext href="https://ai.google.dev/gemini-api/terms">Gemini API Additional Terms</Ext>. We
        never send your passwords or platform credentials to AI providers. AI output is saved as drafts, and nothing it
        writes is published until you approve it.
      </p>
    ),
  },
  {
    id: "sharing",
    title: "Who we share data with",
    body: (
      <>
        <p>We do not sell your personal data or share it for advertising. We share it only with:</p>
        <ul>
          <li><strong>The platforms you connect,</strong> which receive the content you publish to them and the credentials you gave us for them.</li>
          <li><strong>Service providers</strong> that process data for us: our database host (Supabase), our application hosting provider, and Google (Gemini API, for AI features).</li>
          <li><strong>Websites you link to:</strong> when a post contains a link, our server fetches that public page to build a preview card.</li>
          <li><strong>Authorities,</strong> when the law requires it.</li>
        </ul>
      </>
    ),
  },
  {
    id: "platforms",
    title: "Connected platforms",
    body: (
      <>
        <p>
          When you connect an account, that platform&apos;s own terms and privacy policy also apply, and we only use the
          access it grants to publish your posts, read your profile and read the engagement on posts we published. You can
          disconnect an account in {LEGAL.product} at any time, and revoke our access in the platform&apos;s own settings.
        </p>
        <ul>
          {PLATFORM_POLICIES.map((p) => (
            <li key={p.name}>
              <strong>{p.name}{p.live ? "" : " (when available)"}:</strong> <Ext href={p.terms}>terms</Ext> · <Ext href={p.privacy}>privacy policy</Ext>
              {"note" in p && <> · {p.note}</>}
            </li>
          ))}
        </ul>
      </>
    ),
  },
  {
    id: "platform-data",
    title: "Data we receive from social platforms",
    body: (
      <>
        <p>
          When you connect an account by signing in to a platform (for example with Facebook, Instagram, Threads, YouTube,
          TikTok, X, LinkedIn or Pinterest login), we ask only for the permissions needed for the features you use, and we
          show them on the platform&apos;s consent screen before you agree. Depending on the platform, we receive:
        </p>
        <ul>
          <li><strong>Basic profile:</strong> account or page ID, name, username, profile picture and profile link, so you can see which account is connected.</li>
          <li><strong>Publishing access:</strong> permission to create posts, videos or messages that you write or approve in {LEGAL.product}, on the accounts, pages or channels you choose.</li>
          <li><strong>Performance data:</strong> public metrics and insights (such as views, likes, comments and shares) for posts published through {LEGAL.product}, to show you how they perform.</li>
          <li><strong>Access tokens:</strong> the tokens the platform issues so we can act for you, encrypted at rest.</li>
        </ul>
        <p>We use this data only to provide the features you asked for. In particular, we:</p>
        <ul>
          <li>do not sell platform data, share it with data brokers or use it for advertising;</li>
          <li>do not use platform data to train AI or machine-learning models;</li>
          <li>do not read private messages, follower lists or other accounts&apos; data beyond what is listed above;</li>
          <li>do not let other users see your platform data, except members of the workspace you connected the account to;</li>
          <li>delete a platform&apos;s data and tokens when you disconnect the account, delete the workspace or delete your account, and within 30 days when you revoke our access on the platform or ask us to.</li>
        </ul>
        <p>
          For step-by-step deletion instructions, see our <Link href="/data-deletion">data deletion page</Link> at{" "}
          <a href={`${SITE.url}/data-deletion`}>{SITE.domain}/data-deletion</a>.
        </p>
      </>
    ),
  },
  {
    id: "google",
    title: "Google and YouTube data",
    body: (
      <>
        <p>
          {LEGAL.product}&apos;s use and transfer to any other app of information received from Google APIs will adhere to the{" "}
          <Ext href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</Ext>, including the Limited Use requirements.
        </p>
        <p>
          {LEGAL.product} uses YouTube API Services. When you connect YouTube, you agree to be bound by the <Ext href="https://www.youtube.com/t/terms">YouTube Terms of Service</Ext>,
          and Google&apos;s use of your data is covered by the <Ext href="https://policies.google.com/privacy">Google Privacy Policy</Ext>.
          You can revoke our access at any time on the <Ext href="https://security.google.com/settings/security/permissions">Google security settings page</Ext>.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies and local storage",
    body: (
      <p>
        We use two strictly necessary, httpOnly cookies to keep you signed in, and your browser&apos;s local storage to remember
        your light or dark theme. We do not use advertising or cross-site tracking cookies.
      </p>
    ),
  },
  {
    id: "security",
    title: "Security",
    body: (
      <ul>
        <li>Passwords are stored as scrypt hashes.</li>
        <li>Platform credentials and sessions are encrypted at rest with AES-256-GCM, and are never shown back to you or sent to your browser.</li>
        <li>Sign-in tokens are short-lived and kept in httpOnly cookies; refresh tokens are single use and stored hashed.</li>
        <li>Data travels over encrypted connections, access is limited by workspace role, and sign-in is rate limited.</li>
      </ul>
    ),
  },
  {
    id: "retention",
    title: "How long we keep data",
    body: (
      <p>
        We keep your data while your account is active. Engagement counts are collected for 30 days after a post is published
        and kept while its workspace exists. When you delete your account, a connected account or a workspace, the related data
        is removed from our live systems straight away, and from backups within 30 days. Posts you already published stay on
        each platform until you delete them there.
      </p>
    ),
  },
  {
    id: "your-rights",
    title: "Your rights",
    body: (
      <>
        <p>
          Depending on where you live, you may have the right to access, correct, export or delete your data, and to object to or
          restrict how we use it. You can edit your profile and delete your account yourself in{" "}
          <Link href="/me">your profile</Link>. See <Link href="/data-deletion">data deletion</Link> for the details.
        </p>
        <p>
          For anything else, email <a href={`mailto:${LEGAL.privacyEmail}`}>{LEGAL.privacyEmail}</a> and we will reply within
          30 days. You may also complain to your local data-protection authority.
        </p>
      </>
    ),
  },
  {
    id: "transfers",
    title: "International transfers",
    body: <p>Our providers may process data in other countries. Where the law requires it, we rely on appropriate safeguards, such as standard contractual clauses, for these transfers.</p>,
  },
  {
    id: "children",
    title: "Children",
    body: <p>{LEGAL.product} is not directed to children under {LEGAL.minimumAge}, and we do not knowingly collect their data. If you think a child has given us data, contact us and we will delete it.</p>,
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: <p>If we make material changes, we will update the effective date above and tell you by email or in the app before they take effect.</p>,
  },
];

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Privacy Policy"
      current="/privacy"
      intro={<p>This policy explains what data {LEGAL.product} collects when you use our website and app, why we collect it, who we share it with, and the choices you have.</p>}
      sections={sections}
    />
  );
}
