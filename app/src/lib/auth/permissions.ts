/**
 * RBAC source of truth — docs/09 §4.
 * UI gating is UX only; Route Handlers and Postgres RLS enforce authoritatively.
 */
export const ROLES = [
  "super_admin",
  "operations_admin",
  "finance_admin",
  "support_admin",
  "technical_admin",
  "read_only_analyst",
] as const;
export type RoleKey = (typeof ROLES)[number];

export const ROLE_LABELS: Record<RoleKey, string> = {
  super_admin: "Super Admin",
  operations_admin: "Operations Admin",
  finance_admin: "Finance Admin",
  support_admin: "Support Admin",
  technical_admin: "Technical Admin",
  read_only_analyst: "Read-Only Analyst",
};

export const ROLE_DESCRIPTIONS: Record<RoleKey, string> = {
  super_admin: "Platform governance, admin team, final approvals",
  operations_admin: "Day-to-day account operations",
  finance_admin: "Revenue, payments, pricing",
  support_admin: "Account reviews, support cases",
  technical_admin: "Service health, sync pipeline, errors",
  read_only_analyst: "Reporting and analysis — zero mutations",
};

const ALL_PERMISSIONS = [
  "dashboard.view",
  "revenue.view",
  "sales.view",
  "businesses.read",
  "businesses.suspend",
  "businesses.restore",
  "businesses.delete",
  "subscriptions.read",
  "subscriptions.adjust",
  "payments.read",
  "payments.review",
  "pricing.read",
  "pricing.update",
  "analytics.read",
  "vision.read",
  "angel.read",
  "intelligence.read",
  "health.read",
  "health.manage_errors",
  "health.manage_sync",
  "incidents.read",
  "incidents.manage",
  "ai_data.read",
  "ai_data.manage",
  "admin_team.read",
  "admin_team.invite",
  "commands.read",
  "commands.approve",
  "audit.read",
  "audit.export",
  "settings.view",
  "notifications.manage",
] as const;
export type Permission = (typeof ALL_PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<RoleKey, Permission[]> = {
  super_admin: [...ALL_PERMISSIONS],
  operations_admin: [
    "dashboard.view", "revenue.view", "sales.view", "businesses.read",
    "businesses.suspend", "businesses.restore", "subscriptions.read", "payments.read",
    "analytics.read", "vision.read", "incidents.read", "incidents.manage",
    "commands.read", "commands.approve", "settings.view",
  ],
  finance_admin: [
    "dashboard.view", "revenue.view", "sales.view", "businesses.read",
    "subscriptions.read", "subscriptions.adjust", "payments.read", "payments.review",
    "pricing.read", "pricing.update", "analytics.read", "commands.read", "commands.approve",
    "settings.view",
  ],
  support_admin: [
    "dashboard.view", "businesses.read", "subscriptions.read", "payments.read",
    "analytics.read", "vision.read", "incidents.read", "incidents.manage",
    "commands.read", "settings.view",
  ],
  technical_admin: [
    "dashboard.view", "sales.view", "businesses.read", "analytics.read", "vision.read",
    "angel.read", "intelligence.read", "health.read", "health.manage_errors",
    "health.manage_sync", "incidents.read", "incidents.manage", "ai_data.read",
    "ai_data.manage", "commands.read", "settings.view",
  ],
  read_only_analyst: [
    "dashboard.view", "revenue.view", "sales.view", "businesses.read",
    "subscriptions.read", "payments.read", "analytics.read", "vision.read", "pricing.read",
  ],
};

export function hasPermission(permissions: string[], key: Permission): boolean {
  return permissions.includes(key);
}

/** Command registry — docs/08 §B (`command_types`). */
export interface CommandTypeSpec {
  label: string;
  permission: Permission;
  secondApproval: boolean;
  targetType: "business" | "subscription" | "pricing" | "admin" | "dataset";
}

export const COMMAND_TYPES: Record<string, CommandTypeSpec> = {
  "review.note": { label: "Review note", permission: "payments.review", secondApproval: true, targetType: "business" },
  "business.suspend": { label: "Suspend account", permission: "businesses.suspend", secondApproval: true, targetType: "business" },
  "business.restore": { label: "Restore account", permission: "businesses.restore", secondApproval: false, targetType: "business" },
  "subscription.adjust": { label: "Adjust subscription", permission: "subscriptions.adjust", secondApproval: true, targetType: "subscription" },
  "pricing.upsert": { label: "Update pricing", permission: "pricing.update", secondApproval: true, targetType: "pricing" },
  "pricing.deactivate": { label: "Deactivate price", permission: "pricing.update", secondApproval: true, targetType: "pricing" },
  "admin.invite": { label: "Invite administrator", permission: "admin_team.invite", secondApproval: false, targetType: "admin" },
  "admin.role_change": { label: "Change administrator role", permission: "admin_team.invite", secondApproval: true, targetType: "admin" },
  "admin.deactivate": { label: "Deactivate administrator", permission: "admin_team.invite", secondApproval: true, targetType: "admin" },
  "dataset.version_register": { label: "Register dataset version", permission: "ai_data.manage", secondApproval: false, targetType: "dataset" },
  "dataset.delete": { label: "Delete dataset", permission: "ai_data.manage", secondApproval: true, targetType: "dataset" },
};
