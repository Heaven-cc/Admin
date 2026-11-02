import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getDataProvider } from "@/lib/data";
import { Shell } from "@/components/layout/shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const provider = getDataProvider();
  const [notifications, sync, businesses] = await Promise.all([
    provider.listNotifications().then(items => ({items,unavailable:false})).catch(() => ({items:[],unavailable:true})),
    provider.getSyncHealth().catch(() => ({ status: "no_data" as const, lagMinutes: null, lastEventAt: null })),
    provider.listBusinesses({}).catch(() => ({ data: [], total: 0 })),
  ]);

  return (
    <Shell
      permissions={session.permissions}
      role={session.role}
      name={session.name}
      email={session.email}
      notifications={notifications.items}
      notificationsUnavailable={notifications.unavailable}
      syncStatus={sync.status}
      businesses={businesses.data.slice(0, 80).map((b) => ({ id: b.businessId, name: b.name }))}
    >
      {children}
    </Shell>
  );
}
