import Image from "next/image";
import { cn } from "@/lib/utils/cn";

export function BrandLogo({ className, priority = false }: { className?: string; priority?: boolean }) {
  return <Image src="/branding/odt-logo.png" alt="ODT" width={1801} height={887}
    unoptimized priority={priority} className={cn("h-auto w-20 shrink-0 object-contain", className)} />;
}
