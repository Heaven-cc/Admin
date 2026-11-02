import type { Permission } from "@/lib/auth/permissions";

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  permission: Permission;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** Sidebar navigation — docs/04 §2. Icons resolved in sidebar.tsx. */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Business",
    items: [
      { href: "/overview", label: "Overview", icon: "LayoutDashboard", permission: "dashboard.view" },
      { href: "/businesses", label: "Businesses", icon: "Store", permission: "businesses.read" },
      { href: "/subscriptions", label: "Subscriptions", icon: "CreditCard", permission: "subscriptions.read" },
      { href: "/payments", label: "Payments", icon: "Banknote", permission: "payments.read" },
      { href: "/analytics", label: "Product Analytics", icon: "ChartColumn", permission: "analytics.read" },
    ],
  },
  {
    label: "Services",
    items: [
      { href: "/vision", label: "Vision", icon: "Camera", permission: "vision.read" },
      { href: "/intelligence", label: "Intelligence", icon: "Brain", permission: "intelligence.read" },
      { href: "/angel", label: "Angel", icon: "Sparkles", permission: "angel.read" },
      { href: "/health", label: "System Health", icon: "Activity", permission: "health.read" },
      { href: "/incidents", label: "Incidents", icon: "TriangleAlert", permission: "incidents.read" },
    ],
  },
  {
    label: "Platform",
    items: [
      { href: "/ai-data", label: "AI Data", icon: "Database", permission: "ai_data.read" },
      { href: "/admin-team", label: "Admin Team", icon: "Users", permission: "admin_team.read" },
      { href: "/audit", label: "Audit Logs", icon: "ScrollText", permission: "audit.read" },
      { href: "/settings/pricing", label: "Country Pricing", icon: "Banknote", permission: "pricing.read" },
      { href: "/settings", label: "Settings", icon: "Settings", permission: "settings.view" },
    ],
  },
];
