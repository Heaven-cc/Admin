import { describe, expect, it } from "vitest";
import {
  formatMoney, formatDelta, formatRelative, humanize, minorToMajor,
} from "@/lib/utils/format";

describe("formatMoney", () => {
  it("formats NGN minor units (2 dp currency)", () => {
    expect(formatMoney(1_500_000, "NGN")).toContain("15,000");
  });

  it("treats XOF as zero-exponent (minor = major)", () => {
    expect(minorToMajor(21_000, "XOF")).toBe(21_000);
    expect(minorToMajor(3_500_000, "NGN")).toBe(35_000);
  });

  it("compacts large values", () => {
    const out = formatMoney(48_250_000_00, "USD", true);
    expect(out).toMatch(/M|K/);
  });
});

describe("formatDelta", () => {
  it("signs positive and negative deltas", () => {
    expect(formatDelta(6.98)).toBe("+7.0%");
    expect(formatDelta(-3.2)).toBe("-3.2%");
    expect(formatDelta(null)).toBe("—");
  });
});

describe("formatRelative", () => {
  it("renders minutes and hours", () => {
    const now = new Date("2026-10-15T12:00:00Z");
    expect(formatRelative(new Date("2026-10-15T11:30:00Z"), now)).toBe("30 min ago");
    expect(formatRelative(new Date("2026-10-15T09:00:00Z"), now)).toBe("3 h ago");
  });
});

describe("humanize", () => {
  it("reads command types", () => {
    expect(humanize("business.suspend")).toBe("Business Suspend");
  });
});
