import { describe, it, expect } from "vitest";
import { passwordSchema, registerFormSchema } from "./password";

describe("passwordSchema", () => {
  it("rejects short or simple passwords", () => {
    expect(passwordSchema.safeParse("short").success).toBe(false);
    expect(passwordSchema.safeParse("alllowercase1!").success).toBe(false);
    expect(passwordSchema.safeParse("ALLUPPERCASE1!").success).toBe(false);
    expect(passwordSchema.safeParse("NoDigitsHere!").success).toBe(false);
    expect(passwordSchema.safeParse("NoSpecial123").success).toBe(false);
  });

  it("accepts a strong password", () => {
    expect(passwordSchema.safeParse("Password123!").success).toBe(true);
  });
});

describe("registerFormSchema", () => {
  it("requires name email and strong password", () => {
    const bad = registerFormSchema.safeParse({
      full_name: "A",
      email: "not-an-email",
      password: "weak",
    });
    expect(bad.success).toBe(false);

    const good = registerFormSchema.safeParse({
      full_name: "Priya Patel",
      email: "priya@lead.ai",
      password: "Password123!",
      city: "Mumbai",
    });
    expect(good.success).toBe(true);
  });
});
