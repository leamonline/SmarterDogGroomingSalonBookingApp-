import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { Login } from "./Login";

// Mock AuthContext
const mockLogin = vi.fn();
vi.mock("@/src/lib/AuthContext", () => ({
  useAuth: () => ({ login: mockLogin }),
}));

// Mock API
const mockApiLogin = vi.fn();
const mockApiRequestPasswordReset = vi.fn();
vi.mock("@/src/lib/api", () => ({
  api: {
    login: (...args: any[]) => mockApiLogin(...args),
    requestPasswordReset: (...args: any[]) => mockApiRequestPasswordReset(...args),
  },
}));

afterEach(cleanup);

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  );
}

describe("Login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the login form with email and password fields", () => {
    renderLogin();
    expect(screen.getByText("Welcome back")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("shows validation errors when submitting empty form", async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByText("Email is required")).toBeInTheDocument();
    expect(screen.getByText("Password is required")).toBeInTheDocument();
  });

  it("shows email format error for invalid email", async () => {
    const user = userEvent.setup();
    renderLogin();
    // Use a value that passes HTML5 type="email" validation but fails our stricter regex
    await user.type(screen.getByLabelText("Email"), "user@nodot");
    await user.type(screen.getByLabelText("Password"), "password123");
    // Submit via fireEvent to bypass any remaining native validation
    fireEvent.submit(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
  });

  it("shows forgot password panel when link is clicked", async () => {
    const user = userEvent.setup();
    renderLogin();
    const forgotLinks = screen.getAllByText("Forgot password?");
    await user.click(forgotLinks[0]);
    expect(screen.getByText(/send you a password reset link/i)).toBeInTheDocument();
  });

  it("calls login API on valid form submission", async () => {
    mockApiLogin.mockResolvedValue({
      token: "test-token",
      user: { id: "1", email: "test@example.com", role: "owner" },
    });

    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(mockApiLogin).toHaveBeenCalledWith({ email: "test@example.com", password: "password123" });
  });

  it("shows error message on failed login", async () => {
    mockApiLogin.mockRejectedValue(new Error("Invalid credentials"));

    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Invalid credentials")).toBeInTheDocument();
  });
});
