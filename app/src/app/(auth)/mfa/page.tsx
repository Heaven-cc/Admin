import { safeNext } from "@/lib/auth/redirect";
import type { Metadata } from "next";
import { MfaForm } from "./mfa-form";

export const metadata: Metadata = { title: "Two-factor authentication" };

export default async function MfaPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <MfaForm nextPath={safeNext(next)} />;
}
