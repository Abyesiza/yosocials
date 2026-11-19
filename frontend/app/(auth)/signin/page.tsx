import type { Metadata } from "next";
import { Suspense } from "react";
import { FormSkeleton } from "@/app/components/skeletons";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Log in" };

export default function Page() {
  return (
    <Suspense fallback={<FormSkeleton fields={2} />}>
      <AuthForm mode="signin" />
    </Suspense>
  );
}
