import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL, PLATFORM_POLICIES } from "../_components/legal/legal-config";
import { Ext, LegalDocument, type LegalSection } from "../_components/legal/legal-document";

export const metadata: Metadata = {
  title: "Data deletion",
  description: `How to delete your ${LEGAL.product} account and data, and revoke platform access.`,
  alternates: { canonical: "/data-deletion" },
};

const REVOKE = [
  { name: "Bluesky", how: "Settings → Privacy and security → App passwords → delete the Yo Socials password." },
  { name: "Mastodon", how: "On your server: Preferences → Development (or Account → Authorized apps) → remove the application." },
  { name: "Telegram", how: "Remove the bot from your channel's administrators, or revoke its token with @BotFather." },
  { name: "Discord", how: "Server Settings → Integrations → Webhooks → delete the webhook." },
] as const;

const sections: LegalSection[] = [
  {
    id: "delete-account",
    title: "Delete your whole account",
    body: (
      <>
        <ul>
          <li>Sign in and open <Link href="/me">your profile</Link>.</li>
          <li>Under <strong>Delete account</strong>, enter your password, tick the confirmation and choose <strong>Delete my account</strong>.</li>
        </ul>
        <p>
          If a workspace you own has other members, make one of them an owner first (or delete that workspace), so your
          teammates don&apos;t lose it.
        </p>
      </>
    ),
  },
  {
    id: "what-is-deleted",
    title: "What gets deleted",
    body: (
      <ul>
        <li>Your profile: name, email and password hash.</li>
        <li>All your sign-in sessions; every device is signed out at once.</li>
        <li>Every workspace where you are the only member, with its connected accounts, stored credentials and platform sessions, posts, drafts, schedules and analytics.</li>
        <li>Your membership in workspaces shared with others. Posts you created there stay with the workspace, without your name on them.</li>
      </ul>
    ),
  },
  {
    id: "partial",
    title: "Delete only part of your data",
    body: (
      <ul>
        <li><strong>A connected account:</strong> Accounts → Disconnect. This deletes its stored credentials, ends its platform session, and removes its posts and analytics from {LEGAL.product}.</li>
        <li><strong>A workspace:</strong> Settings → Delete workspace (owners only).</li>
        <li><strong>A post:</strong> open it and choose Delete.</li>
      </ul>
    ),
  },
  {
    id: "platform-access",
    title: "Revoke access on each platform",
    body: (
      <>
        <p>You can also cut off our access from the platform itself, at any time:</p>
        <ul>
          {REVOKE.map((r) => <li key={r.name}><strong>{r.name}:</strong> {r.how}</li>)}
          <li><strong>Google and YouTube:</strong> <Ext href="https://security.google.com/settings/security/permissions">Google account permissions</Ext>.</li>
          <li><strong>Facebook and Instagram:</strong> Settings → Apps and websites → remove {LEGAL.product}.</li>
        </ul>
        <p className="text-sm">Platform policies: {PLATFORM_POLICIES.filter((p) => p.live).map((p, i) => <span key={p.name}>{i > 0 && " · "}<Ext href={p.privacy}>{p.name}</Ext></span>)}.</p>
      </>
    ),
  },
  {
    id: "published",
    title: "Posts already published",
    body: <p>Deleting data in {LEGAL.product} does not delete posts that are already live on a platform. Delete those on the platform itself.</p>,
  },
  {
    id: "timing",
    title: "Timing",
    body: <p>Deletions take effect straight away in our live systems. Copies in backups are removed within 30 days.</p>,
  },
  {
    id: "by-email",
    title: "Ask us to delete it",
    body: (
      <p>
        If you can&apos;t sign in, or you connected an account through a platform login, email{" "}
        <a href={`mailto:${LEGAL.privacyEmail}?subject=Data%20deletion%20request`}>{LEGAL.privacyEmail}</a> from the address on
        your account, and we will confirm when the data is gone, within 30 days.
      </p>
    ),
  },
];

export default function DataDeletionPage() {
  return (
    <LegalDocument
      title="Data deletion"
      current="/data-deletion"
      intro={<p>You can delete your data from {LEGAL.product} yourself at any time. This page explains how, and what each option removes. See also our <Link href="/privacy">Privacy Policy</Link>.</p>}
      sections={sections}
    />
  );
}
