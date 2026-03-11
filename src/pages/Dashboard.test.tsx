import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { Dashboard } from "./Dashboard";
import type { Appointment } from "@/src/components/AppointmentModal";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockGetAppointments = vi.fn();
const mockGetAnalytics = vi.fn();
const mockUpdateAppointment = vi.fn();
const mockCreateAppointment = vi.fn();
vi.mock("@/src/lib/api", () => ({
  api: {
    getAppointments: (...args: any[]) => mockGetAppointments(...args),
    getAnalytics: () => mockGetAnalytics(),
    updateAppointment: (...args: any[]) => mockUpdateAppointment(...args),
    createAppointment: (...args: any[]) => mockCreateAppointment(...args),
  },
}));

afterEach(cleanup);

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: `apt-${Math.random().toString(36).slice(2, 8)}`,
    petName: "Buddy",
    breed: "Labrador",
    ownerName: "Jane Doe",
    service: "Full Groom",
    date: new Date(),
    duration: 60,
    status: "confirmed",
    price: 45,
    avatar: "",
    ...overrides,
  };
}

function setupMocks(appointments: Appointment[] = []) {
  mockGetAppointments.mockResolvedValue(appointments.map((a) => ({ ...a, date: a.date.toISOString() })));
  mockGetAnalytics.mockResolvedValue({
    totalRevenue: 1250,
    appointments: 28,
    activeRate: 85,
    newCustomers: 3,
  });
}

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Use a fixed "now" so isToday checks work
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-03-11T10:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows loading skeleton then renders stat cards", async () => {
    setupMocks([]);
    renderDashboard();

    // Wait for dashboard to load
    expect(await screen.findByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Today's Bookings")).toBeInTheDocument();
    expect(screen.getByText("Live In Salon")).toBeInTheDocument();
    expect(screen.getByText("Ready For Collection")).toBeInTheDocument();
    expect(screen.getByText("Expected Today")).toBeInTheDocument();
  });

  it("displays today's appointment count in the stat card", async () => {
    setupMocks([
      makeAppointment({ petName: "Max", date: new Date("2026-03-11T11:00:00"), status: "confirmed" }),
      makeAppointment({ petName: "Rex", date: new Date("2026-03-11T12:00:00"), status: "checked-in" }),
    ]);
    renderDashboard();

    // The "Today's Bookings" card should show 2
    const bookingsCard = await screen.findByText("Today's Bookings");
    const cardEl = (bookingsCard.closest("[class*='card']") ??
      bookingsCard.parentElement?.parentElement) as HTMLElement;
    expect(cardEl).toBeTruthy();
    expect(within(cardEl).getByText("2")).toBeInTheDocument();
  });

  it("shows appointment rows with pet names and services", async () => {
    setupMocks([
      makeAppointment({ petName: "Coco", service: "Bath & Dry", date: new Date("2026-03-11T10:30:00") }),
      makeAppointment({ petName: "Daisy", service: "Nail Trim", date: new Date("2026-03-11T11:00:00") }),
    ]);
    renderDashboard();

    const cocoElements = await screen.findAllByText(/Coco/);
    expect(cocoElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Bath & Dry/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Daisy/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Nail Trim/).length).toBeGreaterThanOrEqual(1);
  });

  it("shows 'Next up' banner for the next upcoming appointment", async () => {
    setupMocks([
      makeAppointment({
        petName: "Milo",
        date: new Date("2026-03-11T10:30:00"),
        status: "confirmed",
      }),
    ]);
    renderDashboard();

    expect(await screen.findByText(/Next up: Milo/)).toBeInTheDocument();
  });

  it("shows empty state when no appointments match the filter", async () => {
    setupMocks([makeAppointment({ petName: "Buddy", date: new Date("2026-03-11T09:00:00"), status: "completed" })]);
    renderDashboard();

    // Wait for data to load
    await screen.findByText(/Buddy/);

    // Click "In Salon" filter — no appointments should match
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(screen.getByRole("button", { name: /In Salon/ }));

    expect(screen.getByText(/All clear/)).toBeInTheDocument();
  });

  it("filters appointments by schedule filter buttons", async () => {
    setupMocks([
      makeAppointment({ petName: "Active Dog", date: new Date("2026-03-11T09:00:00"), status: "in-progress" }),
      makeAppointment({ petName: "Done Dog", date: new Date("2026-03-11T08:00:00"), status: "completed" }),
    ]);
    renderDashboard();

    await screen.findByText(/Active Dog/);

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    // Click "Done" filter
    await user.click(screen.getByRole("button", { name: /Done/ }));
    expect(screen.getByText(/Done Dog/)).toBeInTheDocument();
    expect(screen.queryByText(/Active Dog/)).not.toBeInTheDocument();

    // Click "In Salon" filter
    await user.click(screen.getByRole("button", { name: /In Salon/ }));
    expect(screen.getByText(/Active Dog/)).toBeInTheDocument();
    expect(screen.queryByText(/Done Dog/)).not.toBeInTheDocument();
  });

  it("navigates to calendar when 'Open Calendar' is clicked", async () => {
    setupMocks([]);
    renderDashboard();

    await screen.findByText("Dashboard");

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(screen.getByRole("button", { name: "Open Calendar" }));

    expect(mockNavigate).toHaveBeenCalledWith("/calendar");
  });

  it("shows 'no urgent follow-ups' when there are no attention items", async () => {
    setupMocks([makeAppointment({ date: new Date("2026-03-11T11:00:00"), status: "confirmed" })]);
    renderDashboard();

    expect(await screen.findByText(/No urgent follow-ups/)).toBeInTheDocument();
  });

  it("handles API errors gracefully", async () => {
    mockGetAppointments.mockRejectedValue(new Error("Network error"));
    mockGetAnalytics.mockRejectedValue(new Error("Network error"));
    renderDashboard();

    // Should still render the dashboard structure (not crash)
    expect(await screen.findByText("Dashboard")).toBeInTheDocument();
  });
});
