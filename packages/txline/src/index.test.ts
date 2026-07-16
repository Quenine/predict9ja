import { describe, expect, it, vi } from "vitest";
import {
  configFromEnvironment,
  createHttpTxlineClient,
  normalizeSnapshot,
  TxlineHistoricalUnavailableError,
  TxlineHttpError,
  TxlineMalformedResponseError,
  TxlineRateLimitError,
  TxlineSubscriptionError,
} from "./index";

describe("TxLINE configuration", () => {
  it("defaults request timeout to 30 seconds", () => {
    expect(configFromEnvironment({ TXLINE_API_TOKEN: "placeholder" }).timeoutMs).toBe(30_000);
  });
});

const START_SECONDS = 1_781_546_400;
const START_MILLISECONDS = START_SECONDS * 1_000;
const fixture = (overrides: Record<string, unknown> = {}) => ({
  FixtureId: 42,
  StartTime: START_SECONDS,
  Participant1: "Kora City",
  Participant2: "Savanna Rovers",
  Participant1IsHome: true,
  GameState: 1,
  ...overrides,
});
const documentedFixture = () => ({
  Ts: START_MILLISECONDS,
  StartTime: START_SECONDS,
  Competition: "World Cup",
  CompetitionId: 7,
  FixtureGroupId: 11,
  Participant1Id: 101,
  Participant1: "Kora City",
  Participant2Id: 102,
  Participant2: "Savanna Rovers",
  FixtureId: 9001,
  Participant1IsHome: true,
});
const json = (body: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
const config = { network: "devnet" as const, apiToken: "api-secret", timeoutMs: 1000 };
const score = () => ({
  FixtureId: 42,
  Seq: 1,
  Ts: "2026-07-15T08:00:00Z",
  Action: "score_update",
  StatusId: 2,
  Stats: { 1: 1, 2: 0 },
});

describe("snapshot normalization", () => {
  it("accepts epoch seconds", () => {
    expect(normalizeSnapshot([fixture()]).fixtures[0]?.startsAt.toISOString()).toBe(
      new Date(START_MILLISECONDS).toISOString(),
    );
  });

  it("accepts epoch milliseconds", () => {
    expect(
      normalizeSnapshot([
        fixture({ StartTime: START_MILLISECONDS }),
      ]).fixtures[0]?.startsAt.getTime(),
    ).toBe(START_MILLISECONDS);
  });

  it("retains ISO datetime compatibility", () => {
    const startTime = "2026-06-15T18:00:00.000Z";
    expect(
      normalizeSnapshot([fixture({ StartTime: startTime })]).fixtures[0]?.startsAt.toISOString(),
    ).toBe(startTime);
  });

  it("accepts absent provider state as UNKNOWN", () => {
    expect(normalizeSnapshot([fixture({ GameState: undefined })]).fixtures[0]?.status).toBe(
      "UNKNOWN",
    );
  });

  it("accepts the documented fixture snapshot shape", () => {
    expect(normalizeSnapshot([documentedFixture()])).toMatchObject({
      fetched: 1,
      rejected: 0,
      fixtures: [{ sourceId: "9001", status: "UNKNOWN" }],
      rejectionReasons: {},
    });
  });

  it("rejects invalid and unreasonable timestamps safely", () => {
    expect(normalizeSnapshot([fixture({ StartTime: 123 })])).toMatchObject({
      rejected: 1,
      fixtures: [],
      rejectionReasons: { INVALID_START_TIME: 1 },
    });
  });

  it("preserves participant 1 when home-listed", () => {
    expect(normalizeSnapshot([fixture()]).fixtures[0]).toMatchObject({
      homeTeam: "Kora City",
      awayTeam: "Savanna Rovers",
      participant1Name: "Kora City",
      participant2Name: "Savanna Rovers",
      participant1IsHome: true,
    });
  });

  it("preserves participant 1 when away-listed and maps legacy state", () => {
    expect(
      normalizeSnapshot([
        fixture({
          FixtureId: "abc",
          Participant1IsHome: false,
          GameState: undefined,
          gameState: 6,
        }),
      ]).fixtures[0],
    ).toMatchObject({
      sourceId: "abc",
      homeTeam: "Savanna Rovers",
      awayTeam: "Kora City",
      participant1Name: "Kora City",
      participant2Name: "Savanna Rovers",
      participant1IsHome: false,
      status: "CANCELLED",
    });
  });

  it("rejects partial records individually with grouped safe reasons", () => {
    expect(
      normalizeSnapshot([
        fixture(),
        { FixtureId: 2, StartTime: START_SECONDS, Participant1: "Only one team" },
        fixture({ FixtureId: "", Participant1: "" }),
      ]),
    ).toMatchObject({
      fetched: 3,
      rejected: 2,
      fixtures: [expect.anything()],
      rejectionReasons: { INVALID_FIXTURE_ID: 1, MISSING_PARTICIPANT: 1 },
    });
  });

  it("preserves unsupported provider states as UNKNOWN", () => {
    expect(normalizeSnapshot([fixture({ GameState: 99 })]).fixtures[0]?.status).toBe("UNKNOWN");
  });
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

describe("historical HTTP responses", () => {
  const historicalClient = (response: Response) => {
    const mock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ token: "guest-secret" }))
      .mockResolvedValueOnce(response);
    return createHttpTxlineClient(config, { fetch: mock, testOrigin: "https://test" });
  };

  it("normalizes a valid historical JSON array", async () => {
    const result = await historicalClient(json([score()])).getHistoricalScores("42");
    expect(result).toMatchObject({ fetched: 1, rejected: 0 });
  });

  it("accepts a valid empty JSON array", async () => {
    await expect(historicalClient(json([])).getHistoricalScores("42")).resolves.toMatchObject({
      fetched: 0,
      scores: [],
      rejectionReasons: {},
    });
  });

  it.each([
    ["empty", ""],
    ["whitespace-only", "   \r\n  "],
  ])("classifies a 200 %s body as unavailable", async (_label, body) => {
    const error = await historicalClient(new Response(body, { status: 200 }))
      .getHistoricalScores("42")
      .catch((value: unknown) => value);
    expect(error).toBeInstanceOf(TxlineHistoricalUnavailableError);
    expect(error).toMatchObject({
      fixtureId: "42",
      status: 200,
      reason: "EMPTY_BODY",
      endpointCategory: "SCORE_HISTORY",
    });
  });

  it("classifies HTTP 204 as unavailable", async () => {
    const error = await historicalClient(new Response(null, { status: 204 }))
      .getHistoricalScores("42")
      .catch((value: unknown) => value);
    expect(error).toBeInstanceOf(TxlineHistoricalUnavailableError);
    expect(error).toMatchObject({ status: 204, reason: "NO_CONTENT" });
  });

  it("classifies malformed non-empty JSON without exposing its payload", async () => {
    const providerPayload = "not-json-provider-secret";
    const error = await historicalClient(new Response(providerPayload, { status: 200 }))
      .getHistoricalScores("42")
      .catch((value: unknown) => value);
    expect(error).toBeInstanceOf(TxlineMalformedResponseError);
    expect(error).toMatchObject({
      fixtureId: "42",
      status: 200,
      reason: "MALFORMED_JSON",
      endpointCategory: "SCORE_HISTORY",
    });
    expect(String(error)).not.toContain(providerPayload);
    expect(JSON.stringify(error)).not.toContain(providerPayload);
  });

  it("retains ordinary typed HTTP errors", async () => {
    await expect(
      historicalClient(new Response(null, { status: 403 })).getHistoricalScores("42"),
    ).rejects.toBeInstanceOf(TxlineSubscriptionError);
  });

  it("does not leak credentials in historical errors", async () => {
    const error = await historicalClient(new Response("", { status: 200 }))
      .getHistoricalScores("42")
      .catch((value: unknown) => value);
    const serialized = JSON.stringify(error);
    expect(String(error)).not.toContain("guest-secret");
    expect(String(error)).not.toContain("api-secret");
    expect(serialized).not.toContain("guest-secret");
    expect(serialized).not.toContain("api-secret");
  });
});
