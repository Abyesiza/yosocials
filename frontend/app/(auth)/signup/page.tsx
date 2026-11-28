import { publicPageMetadata } from "@/app/lib/seo";
import { Suspense } from "react";
import { FormSkeleton } from "@/app/components/skeletons";
import { AuthForm } from "../auth-form";

export const metadata = publicPageMetadata({
  title: "Sign up",
  description: "Sign up free for Aby Socials. Plan with AI, then publish and track posts across LinkedIn, X, TikTok, Bluesky, Mastodon, Telegram and Discord.",
  path: "/signup",
});

export default function Page() {
  return (
    <Suspense fallback={<FormSkeleton fields={4} />}>
      <AuthForm mode="signup" />
    </Suspense>
  );
}
