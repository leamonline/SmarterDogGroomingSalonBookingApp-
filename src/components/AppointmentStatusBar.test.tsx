import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { AppointmentStatusBar } from "./AppointmentStatusBar";
import type { Appointment } from "./AppointmentModal";

// Mock the API module
vi.mock("@/src/lib/api", () => ({
  api: {
    updateAppointment: vi.fn().mockResolvedValue({}),
  },
}));

afterEach(cleanup);

function makeAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: "apt-1",
    petName: "Buddy",
    breed: "Labrador",
    ownerName: "Jane Doe",
    service: "Full Groom",
    date: new Date("2026-03-11T10:00:00"),
    duration: 60,
    status: "confirmed",
    price: 45,
    avatar: "",
    ...overrides,
  };
}

describe("AppointmentStatusBar", () => {
  it("shows 3 transitions for confirmed status", () => {
    render(<AppointmentStatusBar appointment={makeAppointment()} onUpdated={vi.fn()} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(3);
    expect(buttons[0]).toHaveAttribute("title", "Check In");
    expect(buttons[1]).toHaveAttribute("title", "No Show");
    expect(buttons[2]).toHaveAttribute("title", "Cancel");
  });

  it("renders nothing for completed (terminal) status", () => {
    const { container } = render(
      <AppointmentStatusBar appointment={makeAppointment({ status: "completed" })} onUpdated={vi.fn()} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("shows Ready and Incomplete for in-progress", () => {
    render(<AppointmentStatusBar appointment={makeAppointment({ status: "in-progress" })} onUpdated={vi.fn()} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toHaveAttribute("title", "Ready");
    expect(buttons[1]).toHaveAttribute("title", "Incomplete");
  });

  it("shows only Collected for ready-for-collection", () => {
    render(
      <AppointmentStatusBar appointment={makeAppointment({ status: "ready-for-collection" })} onUpdated={vi.fn()} />,
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveAttribute("title", "Collected");
  });

  it("hides label text in compact mode", () => {
    const { container } = render(<AppointmentStatusBar appointment={makeAppointment()} onUpdated={vi.fn()} compact />);
    // In compact mode, span elements with label text should not exist
    const spans = container.querySelectorAll("span");
    expect(spans).toHaveLength(0);
  });
});
