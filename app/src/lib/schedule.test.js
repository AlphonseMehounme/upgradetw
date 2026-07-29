import { describe, it, expect } from "vitest";
import { buildSchedule, readingLine, fromIso, BOOKS } from "./schedule.js";

const CADENCES = ["daily", "weekdays", "weekly"];
const HOURS = [1, 2, 3, 5, 8];
const START = "2026-09-01";

/* 953h curriculum + 5h prescribed re-read (Phase 7 re-reads book 1, 5h) = 958h scheduled. */
const EXPECTED_TOTAL_HOURS = 958;

describe("schedule engine", () => {
  it("curriculum totals 953h max across the 38 books", () => {
    const max = BOOKS.reduce((a, b) => a + b.h[1], 0);
    expect(max).toBe(953);
  });

  it("reading line's timed hours equal 958h (953 + 5h re-read)", () => {
    const timed = readingLine().filter((it) => it.hours > 0);
    const total = timed.reduce((a, it) => a + it.hours, 0);
    expect(total).toBe(EXPECTED_TOTAL_HOURS);
  });

  for (const cadence of CADENCES) {
    for (const hours of HOURS) {
      it(`conserves ${EXPECTED_TOTAL_HOURS}h for cadence=${cadence} hours=${hours}`, () => {
        const sched = buildSchedule({ start: START, cadence, hours });
        const total = sched.reduce((a, s) => a + s.hours, 0);
        expect(total).toBe(EXPECTED_TOTAL_HOURS);
      });

      it(`produces unique, ascending dates for cadence=${cadence} hours=${hours}`, () => {
        const sched = buildSchedule({ start: START, cadence, hours });
        const dates = sched.map((s) => s.date);
        const unique = new Set(dates);
        expect(unique.size).toBe(dates.length);
        for (let i = 1; i < dates.length; i++) {
          expect(dates[i] > dates[i - 1]).toBe(true);
        }
      });

      if (cadence === "weekdays") {
        it(`never schedules a weekend session for hours=${hours}`, () => {
          const sched = buildSchedule({ start: START, cadence, hours });
          for (const s of sched) {
            const day = fromIso(s.date).getDay();
            expect(day).not.toBe(0);
            expect(day).not.toBe(6);
          }
        });
      }
    }
  }

  it("every session respects the per-session hour cap except necessary single-part overflow", () => {
    const sched = buildSchedule({ start: START, cadence: "daily", hours: 2 });
    for (const s of sched) {
      expect(s.hours).toBeLessThanOrEqual(2);
      expect(s.hours).toBeGreaterThan(0);
    }
  });

  it("sessions are numbered sequentially from 0", () => {
    const sched = buildSchedule({ start: START, cadence: "daily", hours: 2 });
    sched.forEach((s, i) => expect(s.i).toBe(i));
  });
});
