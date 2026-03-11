import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { requireRole, requireStaff, requireAdmin, requireOwner } from "../../server/middleware/auth.js";

const makeRes = () => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
};

const run = (middleware: ReturnType<typeof requireRole> | ReturnType<typeof requireStaff>, role?: string) => {
  const req = { user: role ? { role } : undefined } as unknown as Request;
  const res = makeRes();
  const next: NextFunction = vi.fn();
  middleware(req, res, next);
  return { res, next };
};

describe("requireRole", () => {
  it("uses exact membership by default", () => {
    const middleware = requireRole(["customer", "owner"]);

    const groomer = run(middleware, "groomer");
    expect(groomer.next).not.toHaveBeenCalled();
    expect(groomer.res.status).toHaveBeenCalledWith(403);

    const owner = run(middleware, "owner");
    expect(owner.next).toHaveBeenCalled();
  });

  it("supports atLeast mode for hierarchy checks", () => {
    const middleware = requireRole(["receptionist", "owner"], { mode: "atLeast" });

    const receptionist = run(middleware, "receptionist");
    expect(receptionist.next).toHaveBeenCalled();

    const owner = run(middleware, "owner");
    expect(owner.next).toHaveBeenCalled();

    const groomer = run(middleware, "groomer");
    expect(groomer.next).not.toHaveBeenCalled();
    expect(groomer.res.status).toHaveBeenCalledWith(403);
  });

  it("denies requests without assigned role", () => {
    const middleware = requireRole(["owner"]);
    const { res, next } = run(middleware);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("denies requests with invalid role values", () => {
    const middleware = requireRole(["owner"]);
    const { res, next } = run(middleware, "invalid-role");
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe("role shortcuts", () => {
  it("requireStaff allows groomer and above", () => {
    expect(run(requireStaff, "groomer").next).toHaveBeenCalled();
    expect(run(requireStaff, "owner").next).toHaveBeenCalled();
    expect(run(requireStaff, "customer").next).not.toHaveBeenCalled();
  });

  it("requireAdmin allows receptionist and owner", () => {
    expect(run(requireAdmin, "receptionist").next).toHaveBeenCalled();
    expect(run(requireAdmin, "owner").next).toHaveBeenCalled();
    expect(run(requireAdmin, "groomer").next).not.toHaveBeenCalled();
  });

  it("requireOwner allows only owner", () => {
    expect(run(requireOwner, "owner").next).toHaveBeenCalled();
    expect(run(requireOwner, "receptionist").next).not.toHaveBeenCalled();
  });
});
