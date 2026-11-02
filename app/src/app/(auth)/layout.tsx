import { BrandLogo } from "@/components/brand-logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-soft/60 to-background p-4">
      <div className="w-full max-w-md"><BrandLogo priority className="mx-auto mb-6 w-36" />{children}</div>
    </div>
  );
}
