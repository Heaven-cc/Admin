import { MetadataForm } from "@/components/domain/metadata-form";
import { COUNTRIES, PLANS } from "@/lib/data/types";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { can, getSession } from "@/lib/auth/session";
import { getDataProvider } from "@/lib/data";
import { PageHeader } from "@/components/layout/page-header";
import { PricingMatrix } from "@/components/domain/pricing-matrix";

export const metadata: Metadata = { title: "Pricing" };
export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const session = await getSession();
  if (!can(session, "pricing.read")) redirect("/403");

  const provider = getDataProvider();
  const pricing = await provider.getPricing();

  return (
    <>
      <PageHeader
        actions={can(session, "pricing.update") ? <MetadataForm title="Create country price draft" description="Save an independent country and plan price. Drafts do not affect subscriptions or activate payments. Amounts use minor currency units: kobo, pesewas or whole CFA francs." endpoint="/api/v1/pricing/draft" fields={[{key:"country",label:"Country",options:Object.entries(COUNTRIES).map(([value,c])=>({value,label:c.name+" ? "+c.currency}))},{key:"plan",label:"Plan",options:Object.entries(PLANS).map(([value,p])=>({value,label:p.name}))},{key:"minor",label:"Amount in minor units",type:"number"},{key:"effective",label:"Proposed effective date",type:"date",value:new Date().toISOString().slice(0,10)}]} /> : undefined}
        title="Pricing configuration"
        description="Togo and Ivory Coast are priced independently despite sharing XOF (docs/01 A-04). Drafts are versioned. Price activation awaits an approved production billing contract."
      />
      <PricingMatrix pricing={pricing} canEdit={false} />
    </>
  );
}
