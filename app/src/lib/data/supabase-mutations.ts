import { createClient } from "@/lib/supabase/server";
import type { MutationBackend, AuditQuery } from "./provider";
import type { CommandRow } from "./types";
export class SupabaseMutations implements MutationBackend {
  async createCommand(): Promise<CommandRow> { throw new Error("Commands are disabled pending approved production contracts."); }
  async approveCommand(): Promise<CommandRow> { throw new Error("Command approvals are disabled."); }
  async rejectCommand(): Promise<CommandRow> { throw new Error("Command processing is disabled."); }
  async retryDeadLetter(): Promise<void> { throw new Error("Reporting uses checkpoint retries, not event dead letters."); }
  async inviteAdmin(input: { email: string; role: string }): Promise<{ id: string }> {
    const sb = await createClient();
    const { data, error } = await sb.functions.invoke("admin-invitations", { body: input });
    if (error || !data?.id) throw new Error("Invitation was not completed. Check the invitation service before retrying.");
    return { id: data.id };
  }
  async createIncident(input: { title: string; severity: string; services: string[]; note?: string }): Promise<{ id: string }> {
    const sb = await createClient();
    const { data, error } = await sb.rpc("admin_incident_save", { p_id: null, p_title: input.title, p_severity: input.severity, p_services: input.services, p_entry: input.note ?? null });
    if (error) throw new Error("Incident could not be saved (" + error.code + ").");
    return { id: String(data) };
  }
  async updateIncident(id: string, input: { status?: string; entry?: string }): Promise<void> {
    const sb = await createClient();
    const { error } = await sb.rpc("admin_incident_save", { p_id: id, p_status: input.status ?? null, p_entry: input.entry ?? null });
    if (error) throw new Error("Incident could not be updated (" + error.code + ").");
  }
  async markNotificationsRead(): Promise<void> {
    const sb = await createClient();
    const { error } = await sb.rpc("admin_mark_notifications_read");
    if (error) throw new Error("Notification receipts could not be saved.");
  }
  async exportAudit(q: AuditQuery) {
    const { SupabaseProvider } = await import("./supabase");
    return (await new SupabaseProvider().getAudit(q)).entries;
  }
}
