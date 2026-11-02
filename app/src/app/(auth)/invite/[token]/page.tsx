import type { Metadata } from "next";
import { InviteForm } from "./invite-form";

export const metadata: Metadata = { title: "Accept invitation" };

export default async function InvitePage() {
  return <InviteForm />;
}
