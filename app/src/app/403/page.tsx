import Link from "next/link";
import { ShieldX } from "lucide-react";

export const metadata = { title: "Access denied" };

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border border-border bg-surface p-8 text-center">
        <ShieldX aria-hidden className="mx-auto h-10 w-10 text-danger" />
        <h1 className="mt-4 text-xl font-semibold">Access denied</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your role does not hold the permission required for this page. Ask a Super Admin if you
          believe this is an error — every permission request is logged.
        </p>
        <Link
          href="/overview"
          className="mt-6 inline-flex h-9 items-center rounded-md bg-brand px-4 text-sm font-medium text-brand-foreground transition-colors hover:opacity-90"
        >
          Back to Overview
        </Link>
      </div>
    </main>
  );
}
