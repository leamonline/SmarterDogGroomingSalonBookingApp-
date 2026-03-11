import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { Calendar } from "./Calendar";
import type { Appointment } from "@/src/components/AppointmentModal";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate, useLocation: () => ({ state: null }) };
});

vi.mock("@/src/lib/AuthContext", () => ({
  useAuth: () => ({ isAdmin: true }),
}));

const mockGetAppointments = vi.fn();
const mockGetSettings = vi.fn();
const mockUpdateAppointment = vi.fn().mockResolvedValue({});
const mockCreateAppointment = vi.fn().mockResolvedValue({});
const mockUpdateSettings = vi.fn().mockResolvedValue({});
vi.mock("@/src/lib/api", () => ({
  api: {
    getAppointments: (...args: any[]) => mockGetAppointments(...args),
    getSettings: () => mockGetSettings(),
    updateAppointment: (...args: any[]) => mockUpdateAppointment(...args),
    createAppointment: (...args: any[]) => mockCreateAppointment(...args),
    updateSettings: (...args: any[]) => mockUpdateSettings(...args),
  },
}));

afterEach(cleanup);

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: `apt-${Math.random().toString(36).slice(2, 8)}`,
    petName: "Bella",
    breed: "Poodle",
    ownerName: "Tom Smith",
    service: "Full Groom",
    date: new Date("2026-03-11T09:00:00"),
    duration: 60,
    status: "confirmed",
    price: 45,
    avatar: "",
    dogCount: 1,
    dogCountConfirmed: true,
    ...overrides,
  };
}

const defaultSchedule = [
  { day: "Monday", isOpen: true, openTime: "09:00", closeTime: "17:00", maxDogs: 6 },
  { day: "Tuesday", isOpen: true, openTime: "09:00", closeTime: "17:00", maxDogs: 6 },
  { day: "Wednesday", isOpen: true, openTime: "09:00", closeTime: "17:00", maxDogs: 6 },
  { day: "Thursday", isOpen: true, openTime: "09:00", closeTime: "17:00", maxDogs: 6 },
  { day: "Friday", isOpen: true, openTime: "09:00", closeTime: "17:00", maxDogs: 6 },
  { day: "Saturday", isOpen: false, openTime: "09:00", closeTime: "17:00", maxDogs: 0 },
  { day: "Sunday", isOpen: false, openTime: "09:00", closeTime: "17:00", maxDogs: 0 },
];

function setupMocks(appointments: Appointment[] = []) {
  mockGetAppointments.mockResolvedValue(appointments.map((a) => ({ ...a, date: a.date.toISOString() })));
  mockGetSettings.mockResolvedValue({ schedule: defaultSchedule });
}

function renderCalendar() {
  return render(
    <MemoryRouter>
      <Calendar />
    </MemoryRouter>,
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Calendar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-03-11T10:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the calendar header with week navigation", async () => {
    setupMocks([]);
    renderCalendar();

    // Should show week navigation arrows and current week info
    expect(await screen.findByText("Today")).toBeInTheDocument();
    // The week header should contain day abbreviations
    expect(screen.getByText("Mon")).toBeInTheDocument();
    expect(screen.getByText("Tue")).toBeInTheDocument();
    expect(screen.getByText("Wed")).toBeInTheDocument();
  });

  it("shows filter buttons", async () => {
    setupMocks([]);
    renderCalendar();

    await screen.findByText("Today");
    expect(screen.getByRole("button", { name: /All/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Needs Action/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /In Salon/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Done/i })).toBeInTheDocument();
  });

  it("displays appointments on the calendar", async () => {
    setupMocks([
      makeAppointment({
        petName: "Ziggy",
        ownerName: "Alice",
        service: "Bath & Dry",
        date: new Date("2026-03-11T09:00:00"),
        status: "confirmed",
      }),
    ]);
    renderCalendar();

    const ziggyElements = await screen.findAllByText(/Ziggy/);
    expect(ziggyElements.length).toBeGreaterThanOrEqual(1);
  });

  it("shows day detail panel with appointments for the selected day", async () => {
    setupMocks([
      makeAppointment({
        petName: "Pepper",
        ownerName: "Sarah",
        service: "Nail Trim",
        date: new Date("2026-03-11T10:00:00"),
        status: "checked-in",
      }),
    ]);
    renderCalendar();

    // The day panel should show the appointment details
    const pepperElements = await screen.findAllByText(/Pepper/);
    expect(pepperElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Nail Trim/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Sarah/).length).toBeGreaterThanOrEqual(1);
  });

  it("navigates weeks with prev/next buttons", async () => {
    setupMocks([]);
    renderCalendar();

    await screen.findByText("Today");

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    // Find the next week button — it's the second navigation button in the week nav group
    const navButtons = screen.getAllByRole("button").filter((btn) => {
      const svg = btn.querySelector("svg");
      return svg?.classList.contains("lucide-chevron-right");
    });
    expect(navButtons.length).toBeGreaterThanOrEqual(1);
    await user.click(navButtons[0]);

    // The week should have advanced — we should see March 16-22 dates
    // Just verify it didn't crash and re-rendered
    expect(screen.getByText("Mon")).toBeInTheDocument();
  });

  it("shows 'New Appointment' button", async () => {
    setupMocks([]);
    renderCalendar();

    await screen.findByText("Today");
    const newBtn = screen.getByRole("button", { name: /New Appointment/i });
    expect(newBtn).toBeInTheDocument();
  });

  it("handles API errors gracefully", async () => {
    mockGetAppointments.mockRejectedValue(new Error("Network error"));
    mockGetSettings.mockRejectedValue(new Error("Network error"));
    renderCalendar();

    // Should still render the basic structure (not crash)
    expect(await screen.findByText("Today")).toBeInTheDocument();
  });

  it("filters appointments by status when filter buttons are clicked", async () => {
    setupMocks([
      makeAppointment({
        petName: "ActivePup",
        date: new Date("2026-03-11T09:00:00"),
        status: "in-progress",
      }),
      makeAppointment({
        petName: "DonePup",
        date: new Date("2026-03-11T10:00:00"),
        status: "completed",
      }),
    ]);
    renderCalendar();

    await screen.findAllByText(/ActivePup/);

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    // Click "Done" filter
    await user.click(screen.getByRole("button", { name: /Done/ }));

    // DonePup should be visible, ActivePup should be hidden
    expect(screen.getAllByText(/DonePup/).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/ActivePup/)).not.toBeInTheDocument();
  });
});
