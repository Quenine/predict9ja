import { describe, expect, it, vi } from "vitest";
import { createDatabaseClient, PrismaAccelerateConfigurationError } from "./index";

type TestClient = { transport: "standard" | "accelerate" };
function dependencies() {
  const createClient = vi.fn((): TestClient => ({ transport: "standard" }));
  const extendAccelerate = vi.fn((): TestClient => ({ transport: "accelerate" }));
  return { createClient, extendAccelerate };
}

describe("database transport selection", () => {
  it("uses standard Prisma when Accelerate is absent", () => {
    const selected = dependencies();
    expect(createDatabaseClient({}, selected)).toEqual({ transport: "standard" });
    expect(selected.createClient).toHaveBeenCalledWith(undefined);
    expect(selected.extendAccelerate).not.toHaveBeenCalled();
  });

  it.each(["prisma://accelerate.example", "prisma+postgres://accelerate.example"])(
    "uses Accelerate for %s",
    (value) => {
      const selected = dependencies();
      expect(createDatabaseClient({ PRISMA_ACCELERATE_URL: value }, selected)).toEqual({
        transport: "accelerate",
      });
      expect(selected.createClient).toHaveBeenCalledWith({ datasourceUrl: value });
      expect(selected.extendAccelerate).toHaveBeenCalledOnce();
    },
  );

  it.each(["postgresql://database.example", "not a url", "", "   "])(
    "rejects an invalid Accelerate URL without exposing it",
    (value) => {
      const selected = dependencies();
      expect(() => createDatabaseClient({ PRISMA_ACCELERATE_URL: value }, selected)).toThrowError(
        new PrismaAccelerateConfigurationError(),
      );
      expect(selected.createClient).not.toHaveBeenCalled();
    },
  );
});
