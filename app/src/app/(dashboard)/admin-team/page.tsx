import type { Metadata } from "next";
import { can, getSession } from "@/lib/auth/session";
import { getDataProvider } from "@/lib/data";
import { PageHeader } from "@/components/layout/page-header";
import { Unauthorized } from "@/components/states";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, MonoCell } from "@/components/ui/table";
import { StatusChip } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InviteButton } from "./invite-button";
import { ApprovalList } from "./approvals";
import { ROLE_LABELS, type RoleKey } from "@/lib/auth/permissions";
import { formatDateTime, formatRelative } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Admin Team" };
export const dynamic = "force-dynamic";

export default async function AdminTeamPage() {
  const session = await getSession();
  if (!can(session, "admin_team.read")) return <Unauthorized permission="admin_team.read" />;

  const provider = getDataProvider();
  const data = await provider.getAdminTeam();
  const pending = data.commands.filter((c) => c.status === "pending_approval");

  return (
    <>
      <PageHeader
        title="Admin Team"
        description="Administrator accounts, assigned roles, MFA enrollment and invitations. Role changes and deactivation await an approved approval workflow."
        actions={can(session, "admin_team.invite") ? <InviteButton /> : undefined}
      />
      <Tabs defaultValue="admins">
        <TabsList>
          <TabsTrigger value="admins">Administrators</TabsTrigger>
          <TabsTrigger value="approvals">Approvals ({pending.length})</TabsTrigger>
          <TabsTrigger value="commands">Command history</TabsTrigger>
        </TabsList>

        <TabsContent value="admins">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead>
                  <TableHead>Status</TableHead><TableHead>MFA</TableHead><TableHead>Last login</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.admins.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell className="text-xs">{a.email}</TableCell>
                    <TableCell className="text-xs">{ROLE_LABELS[a.role as RoleKey] ?? a.role}</TableCell>
                    <TableCell><StatusChip status={a.status} /></TableCell>
                    <TableCell className="text-xs">{a.mfa ? "enrolled" : "pending"}</TableCell>
                    <TableCell className="text-xs">{a.lastLoginAt ? formatRelative(a.lastLoginAt) : "never"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="approvals">
          {can(session, "commands.approve") ? (
            <ApprovalList commands={pending} />
          ) : (
            <p className="rounded-md border border-border bg-surface p-4 text-xs text-muted-foreground">
              Approving requires the <code className="font-mono">commands.approve</code> permission.
            </p>
          )}
        </TabsContent>

        <TabsContent value="commands">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead><TableHead>Command</TableHead><TableHead>Target</TableHead>
                  <TableHead>Status</TableHead><TableHead>Requested by</TableHead><TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.commands.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell><MonoCell>{c.id}</MonoCell></TableCell>
                    <TableCell className="text-xs font-medium">{c.commandType}</TableCell>
                    <TableCell className="text-xs">{c.targetLabel ?? c.targetId}</TableCell>
                    <TableCell><StatusChip status={c.status} /></TableCell>
                    <TableCell className="text-xs">{c.requestedByName}</TableCell>
                    <TableCell className="text-xs">{formatDateTime(c.createdAt)}</TableCell>
                  </TableRow>
                ))}
                {data.commands.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="py-8 text-center text-xs text-muted-foreground">Command execution is disabled pending approved contracts.</TableCell></TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
