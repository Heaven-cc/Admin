import { describe, expect, it } from "vitest";
import {
  COMMAND_TYPES, ROLES, ROLE_PERMISSIONS, hasPermission,
} from "@/lib/auth/permissions";

describe("RBAC matrix", () => {
  it("super admin holds every permission", () => {
    const all = Object.values(ROLE_PERMISSIONS);
    const max = all.reduce((a, b) => (b.length > a.length ? b : a));
    expect(ROLE_PERMISSIONS.super_admin).toEqual(max);
  });

  it("read-only analyst holds zero mutating permissions", () => {
    const ro = ROLE_PERMISSIONS.read_only_analyst;
    const mutating = ro.filter((p) => /\.(suspend|restore|adjust|update|invite|approve|manage|export)$/.test(p));
    expect(mutating).toEqual([]);
  });

  it("every command type requires an existing permission", () => {
    for (const spec of Object.values(COMMAND_TYPES)) {
      expect(ROLES.length).toBeGreaterThan(0);
      const anyRoleHasIt = Object.values(ROLE_PERMISSIONS).some((perms) =>
        perms.includes(spec.permission)
      );
      expect(anyRoleHasIt).toBe(true);
    }
  });

  it("hasPermission does exact matching", () => {
    const perms = ROLE_PERMISSIONS.finance_admin;
    expect(hasPermission(perms, "pricing.update")).toBe(true);
    expect(hasPermission(perms, "businesses.suspend")).toBe(false);
  });

  it("high-risk commands require second approval", () => {
    expect(COMMAND_TYPES["business.suspend"].secondApproval).toBe(true);
    expect(COMMAND_TYPES["pricing.upsert"].secondApproval).toBe(true);
    expect(COMMAND_TYPES["business.restore"].secondApproval).toBe(false);
  });
});
