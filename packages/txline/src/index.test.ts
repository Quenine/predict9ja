import { describe, expect, it, vi } from "vitest";
import {
  createHttpTxlineClient,
  normalizeSnapshot,
  TxlineHttpError,
  TxlineRateLimitError,
  TxlineSubscriptionError,
} from "./index";
const fixture = (overrides: Record<string, unknown> = {}) => ({
  FixtureId: 42,
  StartTime: "2026-06-15T18:00:00.000Z",
  Participant1: "Kora City",
  Participant2: "Savanna Rovers",
  Participant1IsHome: true,
  GameState: 1,
  ...overrides,
});
const json = (body: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
const config = { network: "devnet" as const, apiToken: "api-secret", timeoutMs: 1000 };

describe("snapshot normalization", () => {
  it("normalizes numeric and string IDs and derives home teams", () => {
    const result = normalizeSnapshot([
      fixture(),
      fixture({ FixtureId: "abc", Participant1IsHome: false, gameState: 6, GameState: undefined }),
    ]);
    expect(result.fixtures.map((x) => x.sourceId)).toEqual(["42", "abc"]);
    expect(result.fixtures[1]).toMatchObject({
      homeTeam: "Savanna Rovers",
      awayTeam: "Kora City",
      status: "CANCELLED",
    });
  });
  it("supports GameState alternatives and preserves unknown states", () =>
    expect(normalizeSnapshot([fixture({ GameState: 99 })]).fixtures[0]?.status).toBe("UNKNOWN"));
  it("rejects malformed records individually", () =>
    expect(normalizeSnapshot([fixture(), { bad: true }])).toMatchObject({
      fetched: 2,
      rejected: 1,
      fixtures: [expect.anything()],
    }));
});
describe("HTTP client", () => {
  it("acquires a JWT and sends required headers", async () => {
    const mock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ token: "guest-secret" }))
      .mockResolvedValueOnce(json([fixture()]));
    const result = await createHttpTxlineClient(config, {
      fetch: mock,
      testOrigin: "https://test",
    }).snapshots.getFixtures();
    expect(result.fixtures).toHaveLength(1);
    expect(mock).toHaveBeenCalledTimes(2);
    const headers = new Headers(mock.mock.calls[1]?.[1]?.headers);
    expect(headers.get("authorization")).toBe("Bearer guest-secret");
    expect(headers.get("x-api-token")).toBe("api-secret");
  });
  it("refreshes once after 401 and never retries twice", async () => {
    const mock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ jwt: "one" }))
      .mockResolvedValueOnce(json({}, 401))
      .mockResolvedValueOnce(json({ jwt: "two" }))
      .mockResolvedValueOnce(json({}, 401));
    await expect(
      createHttpTxlineClient(config, {
        fetch: mock,
        testOrigin: "https://test",
      }).snapshots.getFixtures(),
    ).rejects.toBeInstanceOf(TxlineHttpError);
    expect(mock).toHaveBeenCalledTimes(4);
  });
  it("deduplicates concurrent guest acquisition", async () => {
    const mock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ token: "one" }))
      .mockImplementation(() => Promise.resolve(json([fixture()])));
    const client = createHttpTxlineClient(config, { fetch: mock, testOrigin: "https://test" });
    await Promise.all([client.snapshots.getFixtures(), client.snapshots.getFixtures()]);
    expect(
      mock.mock.calls.filter(([url]) =>
        (typeof url === "string" ? url : url instanceof URL ? url.href : url.url).includes(
          "guest/start",
        ),
      ),
    ).toHaveLength(1);
  });
  it("maps 403 and 429 without leaking credentials", async () => {
    for (const [status, kind] of [
      [403, TxlineSubscriptionError],
      [429, TxlineRateLimitError],
    ] as const) {
      const mock = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(json({ token: "guest-secret" }))
        .mockResolvedValueOnce(json({}, status, { "retry-after": "15" }));
      const error = await createHttpTxlineClient(config, {
        fetch: mock,
        testOrigin: "https://test",
      })
        .snapshots.getFixtures()
        .catch((value: unknown) => value);
      expect(error).toBeInstanceOf(kind);
      expect(String(error)).not.toContain("secret");
      if (error instanceof TxlineRateLimitError) expect(error.retryAfter).toBe("15");
    }
  });
});
