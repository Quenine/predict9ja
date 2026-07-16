import { describe, expect, it, vi } from "vitest";
import {
  createHttpTxlineClient,
  TxlineMalformedResponseError,
  TxlineProofResponseError,
  TxlineRateLimitError,
  TxlineSubscriptionError,
} from "./index";

const hash = Array(32).fill(1);
const proof = (extra: Record<string, unknown> = {}) => ({
  ts: Date.UTC(2026, 6, 15, 0, 2),
  summary: {
    fixtureId: 18241006,
    updateStats: {
      updateCount: 1,
      minTimestamp: Date.UTC(2026, 6, 15),
      maxTimestamp: Date.UTC(2026, 6, 15, 0, 4),
    },
    eventStatsSubTreeRoot: hash,
  },
  subTreeProof: [{ hash, isRightSibling: false }],
  mainTreeProof: [{ hash, isRightSibling: true }],
  eventStatRoot: hash,
  statsToProve: [
    { key: 1, value: 2, period: 0 },
    { key: 2, value: 1, period: 0 },
  ],
  statProofs: [[{ hash, isRightSibling: false }], [{ hash, isRightSibling: true }]],
  ...extra,
});
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
const config = { network: "devnet" as const, apiToken: "api-secret", timeoutMs: 1_000 };
const request = { fixtureId: "18241006", sequence: 626, statKeys: [2, 1] };

describe("TxLINE proof client", () => {
  it("sends authentication and preserves ordered statKeys query", async () => {
    const value = proof();
    value.statsToProve.reverse();
    value.statProofs.reverse();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ token: "guest-secret" }))
      .mockResolvedValueOnce(json(value));
    const result = await createHttpTxlineClient(config, {
      fetch: fetcher,
      testOrigin: "https://test",
    }).getScoreStatValidation(request);
    const [url, init] = fetcher.mock.calls[1]!;
    const requestUrl = url instanceof Request ? url.url : url.toString();
    expect(requestUrl).toContain("fixtureId=18241006&seq=626&statKeys=2%2C1");
    const headers = new Headers(init?.headers);
    expect(headers.get("authorization")).toBe("Bearer guest-secret");
    expect(headers.get("x-api-token")).toBe("api-secret");
    expect(result.requestedStatKeys).toEqual([2, 1]);
  });
  it("rejects seq zero and duplicate keys before authentication", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const client = createHttpTxlineClient(config, { fetch: fetcher, testOrigin: "https://test" });
    await expect(client.getScoreStatValidation({ ...request, sequence: 0 })).rejects.toThrow(
      "INVALID_SEQUENCE",
    );
    await expect(client.getScoreStatValidation({ ...request, statKeys: [1, 1] })).rejects.toThrow(
      "INVALID_STAT_KEYS",
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("retries once after JWT rejection", async () => {
    const value = proof();
    value.statsToProve.reverse();
    value.statProofs.reverse();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ token: "one" }))
      .mockResolvedValueOnce(json({}, 401))
      .mockResolvedValueOnce(json({ token: "two" }))
      .mockResolvedValueOnce(json(value));
    await createHttpTxlineClient(config, {
      fetch: fetcher,
      testOrigin: "https://test",
    }).getScoreStatValidation(request);
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
  it.each([
    [403, TxlineSubscriptionError],
    [429, TxlineRateLimitError],
  ] as const)("retains typed HTTP error %s", async (status, kind) => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ token: "guest" }))
      .mockResolvedValueOnce(json({}, status));
    await expect(
      createHttpTxlineClient(config, {
        fetch: fetcher,
        testOrigin: "https://test",
      }).getScoreStatValidation(request),
    ).rejects.toBeInstanceOf(kind);
  });
  it.each([
    ["empty", new Response("", { status: 200 })],
    ["malformed", new Response("{bad", { status: 200 })],
  ])("returns a typed safe error for %s responses", async (_label, response) => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ token: "guest-secret" }))
      .mockResolvedValueOnce(response);
    const error = await createHttpTxlineClient(config, {
      fetch: fetcher,
      testOrigin: "https://test",
    })
      .getScoreStatValidation(request)
      .catch((value: unknown) => value);
    expect(error).toBeInstanceOf(TxlineMalformedResponseError);
    expect(JSON.stringify(error)).not.toContain("guest-secret");
    expect(JSON.stringify(error)).not.toContain("api-secret");
  });
  it("rejects fixture and stat-count mismatches without exposing payloads", async () => {
    for (const value of [
      proof({ summary: { ...proof().summary, fixtureId: 99 } }),
      proof({ statProofs: [[{ hash, isRightSibling: false }]] }),
    ]) {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(json({ token: "guest-secret" }))
        .mockResolvedValueOnce(json(value));
      const error = await createHttpTxlineClient(config, {
        fetch: fetcher,
        testOrigin: "https://test",
      })
        .getScoreStatValidation({ ...request, statKeys: [1, 2] })
        .catch((result: unknown) => result);
      expect(error).toBeInstanceOf(TxlineProofResponseError);
      expect(String(error)).not.toContain("guest-secret");
    }
  });
});
