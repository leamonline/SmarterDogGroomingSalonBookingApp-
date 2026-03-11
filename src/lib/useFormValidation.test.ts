import { renderHook, act } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { useFormValidation, required, email, phone, positiveNumber } from "./useFormValidation";

describe("useFormValidation", () => {
  const rules = {
    name: required("Name"),
    email: email,
  };

  it("returns no errors initially", () => {
    const { result } = renderHook(() => useFormValidation(rules));
    expect(result.current.errors).toEqual({});
  });

  it("validates required fields", () => {
    const { result } = renderHook(() => useFormValidation(rules));
    let valid: boolean;
    act(() => {
      valid = result.current.validate({ name: "", email: "" });
    });
    expect(valid!).toBe(false);
    expect(result.current.errors.name).toBe("Name is required");
    expect(result.current.errors.email).toBe("Email is required");
  });

  it("passes when all fields are valid", () => {
    const { result } = renderHook(() => useFormValidation(rules));
    let valid: boolean;
    act(() => {
      valid = result.current.validate({ name: "Max", email: "max@example.com" });
    });
    expect(valid!).toBe(true);
    expect(result.current.errors).toEqual({});
  });

  it("clears a single field error", () => {
    const { result } = renderHook(() => useFormValidation(rules));
    act(() => {
      result.current.validate({ name: "", email: "" });
    });
    expect(result.current.errors.name).toBeDefined();
    act(() => {
      result.current.clearError("name");
    });
    expect(result.current.errors.name).toBeUndefined();
    expect(result.current.errors.email).toBeDefined();
  });

  it("clears all errors", () => {
    const { result } = renderHook(() => useFormValidation(rules));
    act(() => {
      result.current.validate({ name: "", email: "" });
    });
    act(() => {
      result.current.clearAll();
    });
    expect(result.current.errors).toEqual({});
  });
});

describe("email validator", () => {
  it("rejects empty string", () => {
    expect(email("")).toBe("Email is required");
  });

  it("rejects invalid format", () => {
    expect(email("not-an-email")).toBe("Enter a valid email address");
  });

  it("accepts valid email", () => {
    expect(email("user@example.com")).toBeNull();
  });
});

describe("phone validator", () => {
  it("rejects empty string", () => {
    expect(phone("")).toBe("Phone is required");
  });

  it("rejects too few digits", () => {
    expect(phone("123")).toBe("Enter a valid phone number");
  });

  it("accepts valid phone", () => {
    expect(phone("(555) 123-4567")).toBeNull();
  });
});

describe("positiveNumber validator", () => {
  const validate = positiveNumber("Price");

  it("rejects negative numbers", () => {
    expect(validate(-5)).toBe("Price must be a positive number");
  });

  it("rejects NaN", () => {
    expect(validate("abc")).toBe("Price must be a positive number");
  });

  it("accepts zero", () => {
    expect(validate(0)).toBeNull();
  });

  it("accepts positive numbers", () => {
    expect(validate(42)).toBeNull();
  });
});
