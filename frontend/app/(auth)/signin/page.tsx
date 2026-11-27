import { publicPageMetadata } from "@/app/lib/seo";
import { Suspense } from "react";
import { FormSkeleton } from "@/app/components/skeletons";
import { AuthForm } from "../auth-form";

export const metadata = publicPageMetadata({
  title: "Log in",
  description: "Log in to Aby Socials to plan, schedule and track your social media posts.",
  path: "/signin",
});

export default function Page() {
  return (
    <Suspense fallback={<FormSkeleton fields={2} />}>
      <AuthForm mode="signin" />
    </Suspense>
  );
}
