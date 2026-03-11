import { describe, it, expect } from "vitest";
import {
  timeToMinutes,
  minutesToTime,
  allSlotStartTimes,
  isOperatingDay,
  isValidSlotTime,
  toRfc3339,
  slotEndTime,
  SLOT_DURATION_MINUTES,
} from "../src/config.js";

describe("timeToMinutes", () => {
  it("converts HH:MM to minutes since midnight", () => {
    expect(timeToMinutes("00:00")).toBe(0);
    expect(timeToMinutes("08:30")).toBe(510);
    expect(timeToMinutes("13:00")).toBe(780);
    expect(timeToMinutes("23:59")).toBe(1439);
  });
});

describe("minutesToTime", () => {
  it("converts minutes to HH:MM format", () => {
    expect(minutesToTime(0)).toBe("00:00");
    expect(minutesToTime(510)).toBe("08:30");
    expect(minutesToTime(780)).toBe("13:00");
  });

  it("roundtrips with timeToMinutes", () => {
    expect(minutesToTime(timeToMinutes("09:30"))).toBe("09:30");
  });
});

describe("allSlotStartTimes", () => {
  it("returns the correct number of 30-min slots between 08:30 and 13:00", () => {
    const slots = allSlotStartTimes();
    // 08:30, 09:00, 09:30, 10:00, 10:30, 11:00, 11:30, 12:00, 12:30 = 9 slots
    expect(slots).toHaveLength(9);
    expect(slots[0]).toBe("08:30");
    expect(slots[slots.length - 1]).toBe("12:30");
  });

  it("has consistent spacing", () => {
    const slots = allSlotStartTimes();
    for (let i = 1; i < slots.length; i++) {
      expect(timeToMinutes(slots[i]) - timeToMinutes(slots[i - 1])).toBe(SLOT_DURATION_MINUTES);
    }
  });
});

describe("isOperatingDay", () => {
  it("returns true for Mon, Tue, Wed", () => {
    expect(isOperatingDay(new Date("2026-03-09"))).toBe(true); // Monday
    expect(isOperatingDay(new Date("2026-03-10"))).toBe(true); // Tuesday
    expect(isOperatingDay(new Date("2026-03-11"))).toBe(true); // Wednesday
  });

  it("returns false for Thu–Sun", () => {
    expect(isOperatingDay(new Date("2026-03-12"))).toBe(false); // Thursday
    expect(isOperatingDay(new Date("2026-03-13"))).toBe(false); // Friday
    expect(isOperatingDay(new Date("2026-03-14"))).toBe(false); // Saturday
    expect(isOperatingDay(new Date("2026-03-15"))).toBe(false); // Sunday
  });
});

describe("isValidSlotTime", () => {
  it("accepts valid slot times", () => {
    expect(isValidSlotTime("08:30")).toBe(true);
    expect(isValidSlotTime("10:00")).toBe(true);
    expect(isValidSlotTime("12:30")).toBe(true);
  });

  it("rejects invalid times", () => {
    expect(isValidSlotTime("08:00")).toBe(false);
    expect(isValidSlotTime("13:00")).toBe(false);
    expect(isValidSlotTime("10:15")).toBe(false);
    expect(isValidSlotTime("foo")).toBe(false);
  });
});

describe("toRfc3339", () => {
  it("formats date and time as RFC 3339 local datetime", () => {
    expect(toRfc3339("2026-03-11", "09:00")).toBe("2026-03-11T09:00:00");
  });
});

describe("slotEndTime", () => {
  it("adds SLOT_DURATION_MINUTES to start time", () => {
    expect(slotEndTime("08:30")).toBe("09:00");
    expect(slotEndTime("12:30")).toBe("13:00");
    expect(slotEndTime("10:00")).toBe("10:30");
  });
});
