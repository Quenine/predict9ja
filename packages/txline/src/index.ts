import type { FixtureStatus, SourceMode } from "@predict9ja/domain";
import { z } from "zod";
export * from "./scores";
export * from "./sse";
import { normalizeScoreBatch, type ScoreBatch } from "./scores";
import { parseSse, type SseEvent } from "./sse";

export const TXLINE_ORIGINS = {
  devnet: "https://txline-dev.txodds.com",
  mainnet: "https://txline.txodds.com",
} as const;
export const txlineEnvironmentSchema = z.object({
  TXLINE_NETWORK: z.enum(["devnet", "mainnet"]).default("devnet"),
  TXLINE_API_TOKEN: z.string().min(1, "TXLINE_API_TOKEN is required"),
  TXLINE_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().max(60_000).default(10_000),
});
export type TxlineEnvironment = z.infer<typeof txlineEnvironmentSchema>;
export type TxlineConfig = Readonly<{
  network: "devnet" | "mainnet";
  apiToken: string;
  timeoutMs: number;
}>;
export function configFromEnvironment(environment: NodeJS.ProcessEnv): TxlineConfig {
  const value = txlineEnvironmentSchema.parse(environment);
  return {
    network: value.TXLINE_NETWORK,
    apiToken: value.TXLINE_API_TOKEN,
    timeoutMs: value.TXLINE_REQUEST_TIMEOUT_MS,
  };
}

export type NormalizedFixture = Readonly<{
  sourceId: string;
  homeTeam: string;
  awayTeam: string;
  startsAt: Date;
  status: FixtureStatus;
  sourceMode: SourceMode;
  participant1Name: string;
  participant2Name: string;
  participant1IsHome: boolean;
}>;
export type FixtureSnapshotResult = Readonly<{
  fixtures: readonly NormalizedFixture[];
  fetched: number;
  rejected: number;
}>;
export type NormalizedScoreEvent = Readonly<{
  fixtureSourceId: string;
  sequence: number;
  occurredAt: Date;
  homeScore: number;
  awayScore: number;
}>;
export interface SnapshotPort {
  getFixtures(): Promise<FixtureSnapshotResult>;
}
export interface StreamPort {
  subscribe(onEvent: (event: NormalizedScoreEvent) => void): Promise<() => Promise<void>>;
}
export interface TxlineClient {
  snapshots: SnapshotPort;
  stream: StreamPort;
  getScoresSnapshot(fixtureId: string, asOf?: Date): Promise<ScoreBatch>;
  getHistoricalScores(fixtureId: string): Promise<ScoreBatch>;
  openScoresStream(
    options?: Readonly<{ signal?: AbortSignal; lastEventId?: string }>,
  ): Promise<AsyncIterable<SseEvent>>;
}

export class TxlineHttpError extends Error {
  constructor(public readonly status: number) {
    super(`TxLINE request failed with status ${status}`);
    this.name = "TxlineHttpError";
  }
}
export class TxlineSubscriptionError extends TxlineHttpError {
  constructor() {
    super(403);
    this.name = "TxlineSubscriptionError";
    this.message = "TxLINE network or subscription does not permit this request";
  }
}
export class TxlineRateLimitError extends TxlineHttpError {
  constructor(public readonly retryAfter: string | null) {
    super(429);
    this.name = "TxlineRateLimitError";
    this.message = "TxLINE rate limit exceeded";
  }
}
export class LiveTxlineClientNotConfiguredError extends Error {
  constructor() {
    super("TXLINE_API_TOKEN is required for live synchronization");
    this.name = "LiveTxlineClientNotConfiguredError";
  }
}

const guestResponse = z
  .object({ token: z.string().min(1) })
  .or(z.object({ jwt: z.string().min(1) }));
const fixtureRecord = z
  .object({
    FixtureId: z.union([z.string(), z.number()]),
    StartTime: z.string().datetime({ offset: true }),
    Participant1: z.string().min(1),
    Participant2: z.string().min(1),
    Participant1IsHome: z.boolean(),
    GameState: z.union([z.string(), z.number()]).optional(),
    gameState: z.union([z.string(), z.number()]).optional(),
  })
  .refine((value) => value.GameState !== undefined || value.gameState !== undefined);
const snapshotEnvelope = z.union([
  z.array(z.unknown()),
  z.object({ fixtures: z.array(z.unknown()) }),
  z.object({ Fixtures: z.array(z.unknown()) }),
]);
function recordsFrom(value: z.infer<typeof snapshotEnvelope>): unknown[] {
  return Array.isArray(value) ? value : "fixtures" in value ? value.fixtures : value.Fixtures;
}
function statusOf(value: string | number): FixtureStatus {
  const state = String(value);
  return state === "1" ? "SCHEDULED" : state === "6" ? "CANCELLED" : "UNKNOWN";
}

export function normalizeSnapshot(payload: unknown): FixtureSnapshotResult {
  const records = recordsFrom(snapshotEnvelope.parse(payload));
  const fixtures: NormalizedFixture[] = [];
  let rejected = 0;
  for (const record of records) {
    const parsed = fixtureRecord.safeParse(record);
    if (!parsed.success) {
      rejected++;
      continue;
    }
    const value = parsed.data;
    const state = value.GameState ?? value.gameState;
    if (state === undefined) {
      rejected++;
      continue;
    }
    fixtures.push({
      sourceId: String(value.FixtureId),
      homeTeam: value.Participant1IsHome ? value.Participant1 : value.Participant2,
      awayTeam: value.Participant1IsHome ? value.Participant2 : value.Participant1,
      startsAt: new Date(value.StartTime),
      status: statusOf(state),
      sourceMode: "LIVE",
      participant1Name: value.Participant1,
      participant2Name: value.Participant2,
      participant1IsHome: value.Participant1IsHome,
    });
  }
  return { fixtures, fetched: records.length, rejected };
}

class GuestJwtProvider {
  private token: string | undefined;
  private refreshPromise: Promise<string> | undefined;
  constructor(private readonly request: (path: string, init: RequestInit) => Promise<Response>) {}
  get(force = false): Promise<string> {
    if (!force && this.token) return Promise.resolve(this.token);
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = this.acquire().finally(() => {
      this.refreshPromise = undefined;
    });
    return this.refreshPromise;
  }
  private async acquire(): Promise<string> {
    const response = await this.request("/auth/guest/start", { method: "POST" });
    if (!response.ok) throw errorFor(response);
    const parsed = guestResponse.parse(await response.json());
    const token = "token" in parsed ? parsed.token : parsed.jwt;
    this.token = token;
    return token;
  }
}
function errorFor(response: Response): TxlineHttpError {
  if (response.status === 403) return new TxlineSubscriptionError();
  if (response.status === 429) return new TxlineRateLimitError(response.headers.get("retry-after"));
  return new TxlineHttpError(response.status);
}
export function createHttpTxlineClient(
  config: TxlineConfig,
  options: Readonly<{ fetch?: typeof fetch; testOrigin?: string }> = {},
): TxlineClient {
  const fetcher = options.fetch ?? fetch;
  const origin = options.testOrigin ?? TXLINE_ORIGINS[config.network];
  const request = async (path: string, init: RequestInit): Promise<Response> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      return await fetcher(`${origin}${path}`, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  };
  const jwt = new GuestJwtProvider(request);
  const authenticated = async (path: string): Promise<Response> => {
    let token = await jwt.get();
    let response = await request(path, {
      headers: { Authorization: `Bearer ${token}`, "X-Api-Token": config.apiToken },
    });
    if (response.status === 401) {
      token = await jwt.get(true);
      response = await request(path, {
        headers: { Authorization: `Bearer ${token}`, "X-Api-Token": config.apiToken },
      });
    }
    if (!response.ok) throw errorFor(response);
    return response;
  };
  return {
    snapshots: {
      getFixtures: async () =>
        normalizeSnapshot(await (await authenticated("/api/fixtures/snapshot")).json()),
    },
    stream: { subscribe: () => Promise.reject(new LiveTxlineClientNotConfiguredError()) },
    getScoresSnapshot: async (fixtureId, asOf) =>
      normalizeScoreBatch(
        await (
          await authenticated(
            `/api/scores/snapshot/${encodeURIComponent(fixtureId)}${asOf ? `?asOf=${encodeURIComponent(asOf.toISOString())}` : ""}`,
          )
        ).json(),
      ),
    getHistoricalScores: async (fixtureId) =>
      normalizeScoreBatch(
        await (
          await authenticated(`/api/scores/historical/${encodeURIComponent(fixtureId)}`)
        ).json(),
      ),
    openScoresStream: async (streamOptions = {}) => {
      let token = await jwt.get();
      const connect = (value: string) =>
        request("/api/scores/stream", {
          headers: {
            Authorization: `Bearer ${value}`,
            "X-Api-Token": config.apiToken,
            Accept: "text/event-stream",
            "Cache-Control": "no-cache",
            ...(streamOptions.lastEventId ? { "Last-Event-ID": streamOptions.lastEventId } : {}),
          },
          ...(streamOptions.signal ? { signal: streamOptions.signal } : {}),
        });
      let response = await connect(token);
      if (response.status === 401) {
        token = await jwt.get(true);
        response = await connect(token);
      }
      if (!response.ok) throw errorFor(response);
      return parseSse(response.body, streamOptions.signal);
    },
  };
}
const fixture: NormalizedFixture = {
  sourceId: "synthetic-kora-savanna-001",
  homeTeam: "Kora City",
  awayTeam: "Savanna Rovers",
  startsAt: new Date("2026-06-15T18:00:00Z"),
  status: "SCHEDULED",
  sourceMode: "SYNTHETIC",
  participant1Name: "Kora City",
  participant2Name: "Savanna Rovers",
  participant1IsHome: true,
};
export function createSyntheticTxlineClient(): TxlineClient {
  return {
    snapshots: {
      getFixtures: () => Promise.resolve({ fixtures: [fixture], fetched: 1, rejected: 0 }),
    },
    stream: { subscribe: () => Promise.resolve(() => Promise.resolve()) },
    getScoresSnapshot: () =>
      Promise.resolve({ scores: [], fetched: 0, rejected: 0, rejectionReasons: {} }),
    getHistoricalScores: () =>
      Promise.resolve({ scores: [], fetched: 0, rejected: 0, rejectionReasons: {} }),
    openScoresStream: () => Promise.resolve((async function* () {})()),
  };
}
