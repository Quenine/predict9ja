import { describe, expect, it } from "vitest";
import {
  requireDemoSessionSecret,
  requireWebDatabaseEnvironment,
  WebRuntimeEnvironmentError,
} from "./server-runtime";

describe("web runtime environment", () => {
  it("uses safe typed database errors", () => {
    expect(() => requireWebDatabaseEnvironment({})).toThrowError(
      new WebRuntimeEnvironmentError("WEB_DATABASE_ENV_MISSING"),
    );
  });
  it("accepts either standard or Accelerate database configuration", () => {
    expect(() => requireWebDatabaseEnvironment({ DATABASE_URL: "configured" })).not.toThrow();
    expect(() =>
      requireWebDatabaseEnvironment({ PRISMA_ACCELERATE_URL: "configured" }),
    ).not.toThrow();
  });
  it("requires a present and sufficiently long session secret", () => {
    expect(() => requireDemoSessionSecret({})).toThrowError(
      new WebRuntimeEnvironmentError("DEMO_SESSION_SECRET_MISSING"),
    );
    expect(() => requireDemoSessionSecret({ DEMO_SESSION_SECRET: "short" })).toThrowError(
      new WebRuntimeEnvironmentError("DEMO_SESSION_SECRET_INVALID"),
    );
    expect(requireDemoSessionSecret({ DEMO_SESSION_SECRET: "long-enough-secret" })).toBe(
      "long-enough-secret",
    );
  });
});
