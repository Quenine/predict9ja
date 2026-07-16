import { describe, expect, it, vi } from "vitest";
import {
  createHttpTxlineClient,
  TxlineRequestTimeoutError,
  type TxlineClient,
  type TxlineEndpointCategory,
} from "./index";

const abort = () => Promise.reject(new DOMException("request aborted", "AbortError"));
const json = (body: unknown) =>
  Promise.resolve(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
const config = {
  network: "devnet" as const,
  apiToken: "api-token-must-not-leak",
  timeoutMs: 20,
};
const endpointCases: readonly Readonly<
  [TxlineEndpointCategory, (client: TxlineClient) => Promise<unknown>]
>[] = [
  ["FIXTURE_SNAPSHOT", (client) => client.snapshots.getFixtures()],
  ["SCORE_SNAPSHOT", (client) => client.getScoresSnapshot("18241006")],
  ["SCORE_HISTORY", (client) => client.getHistoricalScores("18241006")],
  [
    "PROOF_FETCH",
    (client) =>
      client.getScoreStatValidation({
        fixtureId: "18241006",
        sequence: 963,
        statKeys: [1, 2],
      }),
  ],
  ["SCORE_STREAM", (client) => client.openScoresStream()],
];

describe("TxLINE request timeouts", () => {
  it("classifies guest-auth AbortError and retries exactly once", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(() => abort());
    const error = await createHttpTxlineClient(config, {
      fetch: fetcher,
      testOrigin: "https://test",
      guestRetryDelayMs: 10,
    })
      .snapshots.getFixtures()
      .catch((value: unknown) => value);
    expect(error).toBeInstanceOf(TxlineRequestTimeoutError);
    expect(error).toMatchObject({
      code: "TXLINE_REQUEST_TIMEOUT",
      endpointCategory: "GUEST_AUTH",
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("succeeds when the one guest-auth retry succeeds", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(() => abort())
      .mockImplementationOnce(() => json({ token: "guest-jwt-must-not-leak" }))
      .mockImplementationOnce(() => json([]));
    const result = await createHttpTxlineClient(config, {
      fetch: fetcher,
      testOrigin: "https://test",
      guestRetryDelayMs: 10,
    }).snapshots.getFixtures();
    expect(result.fetched).toBe(0);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it.each(endpointCases)(
    "classifies data AbortError as %s without credential leakage",
    async (category: TxlineEndpointCategory, invoke) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockImplementationOnce(() => json({ token: "guest-jwt-must-not-leak" }))
        .mockImplementationOnce(() => abort());
      const client = createHttpTxlineClient(config, {
        fetch: fetcher,
        testOrigin: "https://test",
      });
      const error: unknown = await invoke(client).catch((value: unknown) => value);
      expect(error).toMatchObject({
        code: "TXLINE_REQUEST_TIMEOUT",
        endpointCategory: category,
      });
      const timeout = error instanceof TxlineRequestTimeoutError ? error : undefined;
      const serialized = JSON.stringify({
        name: error instanceof Error ? error.name : "unknown",
        message: error instanceof Error ? error.message : "unknown",
        code: timeout?.code ?? null,
        endpointCategory: timeout?.endpointCategory ?? null,
      });
      expect(serialized).not.toContain(config.apiToken);
      expect(serialized).not.toContain("guest-jwt-must-not-leak");
      expect(serialized).not.toContain("https://test");
      expect(serialized).not.toContain("stack");
    },
  );

  it("respects timeoutMs when fetch waits for the abort signal", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    );
    const started = Date.now();
    await expect(
      createHttpTxlineClient(
        { ...config, timeoutMs: 15 },
        { fetch: fetcher, testOrigin: "https://test", guestRetryDelayMs: 10 },
      ).snapshots.getFixtures(),
    ).rejects.toMatchObject({ code: "TXLINE_REQUEST_TIMEOUT" });
    expect(Date.now() - started).toBeGreaterThanOrEqual(30);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
