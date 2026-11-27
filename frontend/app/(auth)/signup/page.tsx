import { publicPageMetadata } from "@/app/lib/seo";
import { Suspense } from "react";
import { FormSkeleton } from "@/app/components/skeletons";
import { AuthForm } from "../auth-form";

export const metadata = publicPageMetadata({
  title: "Sign up",
  description: "Create a free Aby Socials account and let the AI agent plan, publish and track posts across Bluesky, Mastodon, Telegram and Discord.",
  path: "/signup",
});

export default function Page() {
  return (
    <Suspense fallback={<FormSkeleton fields={4} />}>
      <AuthForm mode="signup" />
    </Suspense>
  );
}
