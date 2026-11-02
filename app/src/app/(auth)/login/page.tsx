import { safeNext } from "@/lib/auth/redirect";
import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <Suspense>
      <LoginForm nextPath={safeNext(next)} />
    </Suspense>
  );
}
