import type { Metadata } from "next";
import { Suspense } from "react";
import { can, getSession } from "@/lib/auth/session";
import { getDataProvider } from "@/lib/data";
import { PageHeader } from "@/components/layout/page-header";
import { DateRangePicker } from "@/components/layout/date-range";
import { Unauthorized } from "@/components/states";
import { BusinessesView } from "./businesses-view";

export const metadata: Metadata = { title: "Businesses" };
export const dynamic = "force-dynamic";

export default async function BusinessesPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string; status?: string; country?: string; plan?: string; sort?: string; page?: string }>;
}) {
  const session = await getSession();
  if (!can(session, "businesses.read")) return <Unauthorized permission="businesses.read" />;

  const sp = await searchParams;
  const provider = getDataProvider();
  const { data, total } = await provider.listBusinesses(sp);

  return (
    <>
      <PageHeader
        title="Businesses"
        description={`${total} business accounts on TREXVEN. Owner contact details are intentionally out of scope (E3 data never syncs — docs/02 §3).`}
        actions={<Suspense><DateRangePicker enabled={false} /></Suspense>}
      />
      <BusinessesView
        rows={data}
        filters={sp}
      />
    </>
  );
}
