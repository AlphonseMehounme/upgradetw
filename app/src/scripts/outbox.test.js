import { describe, it, expect } from "vitest";
import { reconcileOutboxToggle } from "./outbox.js";

describe("reconcileOutboxToggle (pure outbox decision logic)", () => {
  it("adds a pending op when marking a date done", () => {
    const next = reconcileOutboxToggle([], "2026-08-01", true);
    expect(next.map((o) => o.date)).toEqual(["2026-08-01"]);
  });

  it("replaces an existing pending op for the same date rather than duplicating", () => {
    const first = reconcileOutboxToggle([], "2026-08-01", true);
    const second = reconcileOutboxToggle(first, "2026-08-01", true);
    expect(second).toHaveLength(1);
  });

  it("cancels a still-queued completion when toggled off before flush", () => {
    const queued = reconcileOutboxToggle([], "2026-08-01", true);
    const next = reconcileOutboxToggle(queued, "2026-08-01", false);
    expect(next).toEqual([]);
  });

  it("toggling off a date with no pending op is a no-op", () => {
    const next = reconcileOutboxToggle([], "2026-08-01", false);
    expect(next).toEqual([]);
  });

  it("leaves other dates' pending ops untouched", () => {
    let ops = reconcileOutboxToggle([], "2026-08-01", true);
    ops = reconcileOutboxToggle(ops, "2026-08-02", true);
    const next = reconcileOutboxToggle(ops, "2026-08-01", false);
    expect(next.map((o) => o.date)).toEqual(["2026-08-02"]);
  });
});
