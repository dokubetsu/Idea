import { describe, it, expect } from "vitest";
import { resolveApiBase } from "./resolveBase";

describe("resolveApiBase", () => {
  it("defaults to localhost in development", () => {
    expect(resolveApiBase(undefined, "development")).toBe("http://localhost:8000");
    expect(resolveApiBase("http://127.0.0.1:9000/", "development")).toBe(
      "http://127.0.0.1:9000",
    );
  });

  it("requires https non-localhost in production", () => {
    expect(() => resolveApiBase(undefined, "production")).toThrow(/must be set/i);
    expect(() => resolveApiBase("http://api.example.com", "production")).toThrow(
      /https/i,
    );
    expect(() =>
      resolveApiBase("https://localhost:8000", "production"),
    ).toThrow(/localhost/i);
    expect(resolveApiBase("https://api.lead.ai/", "production")).toBe(
      "https://api.lead.ai",
    );
  });
});
