import { BrandLogo } from "@/components/brand-logo";
export default function SetupPage() {
  return <main className="flex min-h-screen items-center justify-center p-6"><section className="max-w-lg rounded-lg border border-border bg-surface p-8"><BrandLogo className="mb-6 w-32" /><h1 className="text-xl font-semibold">Admin integration required</h1><p className="mt-3 text-sm text-muted-foreground">Connect the separate TREXVEN Admin backend to enable administrator access and operational reporting. Data remains unavailable until that connection is configured.</p></section></main>;
}
