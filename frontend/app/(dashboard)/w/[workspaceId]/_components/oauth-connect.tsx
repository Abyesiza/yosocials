"use client";

import { LuExternalLink } from "react-icons/lu";
import { buttonClasses, Card, PlatformIcon, platformLabel } from "@/app/components/ui";
import type { Platform } from "@/app/lib/api/types";
import { useWorkspace } from "./workspace-context";

interface OAuthSpec {
  intro: string;
  permissions: string[];
  notes: string[];
}

const SPECS: Partial<Record<Platform, OAuthSpec>> = {
  tiktok: {
    intro: "Sign in with TikTok and approve access. Aby Socials never sees your TikTok password.",
    permissions: [
      "Read your profile name, username and picture, so you can tell which account is connected.",
      "Post videos and photos you approve, directly or as drafts in your TikTok inbox.",
      "Read views, likes, comments and shares of videos posted through Aby Socials.",
    ],
    notes: [
      "You choose who can see each post, and whether people can comment, Duet or Stitch, every time you post.",
      "You can remove access at any time in TikTok: Settings and privacy → Security and permissions → Apps and services permissions.",
    ],
  },
};

/** Connects a platform through its own sign-in page (OAuth) instead of pasted credentials. */
export function OAuthConnect({ platform, available }: { platform: Platform; available: boolean }) {
  const { workspaceId } = useWorkspace();
  const spec = SPECS[platform];
  const label = platformLabel(platform);
  return (
    <Card className="space-y-5 p-6">
      <div className="flex items-center gap-2">
        <PlatformIcon platform={platform} size={20} />
        <h3 className="font-semibold text-foreground">Connect {label}</h3>
      </div>
      {spec && (
        <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-4 text-sm">
          <p className="font-medium text-foreground">{spec.intro}</p>
          <p className="font-semibold text-foreground">Aby Socials will be able to:</p>
          <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
            {spec.permissions.map((p) => <li key={p}>{p}</li>)}
          </ul>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {spec.notes.map((n) => <li key={n}>{n}</li>)}
          </ul>
        </div>
      )}
      {available ? (
        // A full navigation: the server route redirects to the platform.
        <a href={`/integrations/${platform}/start?workspace=${workspaceId}`} className={buttonClasses("primary", "md")}>
          Continue with {label} <LuExternalLink className="h-4 w-4" aria-hidden />
        </a>
      ) : (
        <p className="text-sm text-muted-foreground">{label} isn’t switched on for this server yet. Ask whoever runs Aby Socials to add its app credentials.</p>
      )}
    </Card>
  );
}
