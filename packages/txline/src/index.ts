import type { FixtureStatus, SourceMode } from "@predict9ja/domain";
import {
  normalizeScoreStatProof,
  validateScoreStatRequest,
  type NormalizedScoreStatProof,
  type ScoreStatValidationRequest,
} from "@predict9ja/verification";
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
  rejectionReasons: Readonly<Partial<Record<FixtureRejectionReason, number>>>;
}>;
export type FixtureRejectionReason =
  "INVALID_RECORD" | "INVALID_START_TIME" | "MISSING_PARTICIPANT" | "INVALID_FIXTURE_ID";
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
  getScoreStatValidation(input: ScoreStatValidationRequest): Promise<NormalizedScoreStatProof>;
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
export type TxlineEndpointCategory =
  | "GUEST_AUTH"
  | "FIXTURE_SNAPSHOT"
  | "SCORE_SNAPSHOT"
  | "SCORE_HISTORY"
  | "SCORE_STREAM"
  | "PROOF_FETCH";
export class TxlineRequestTimeoutError extends Error {
  readonly code = "TXLINE_REQUEST_TIMEOUT" as const;
  constructor(public readonly endpointCategory: TxlineEndpointCategory) {
    super("TxLINE request timed out");
    this.name = "TxlineRequestTimeoutError";
  }
}
export type TxlineHistoricalUnavailableReason = "EMPTY_BODY" | "NO_CONTENT";
export class TxlineHistoricalUnavailableError extends Error {
  readonly endpointCategory = "SCORE_HISTORY" as const;
  constructor(
    public readonly fixtureId: string,
    public readonly status: number,
    public readonly reason: TxlineHistoricalUnavailableReason,
  ) {
    super("TxLINE historical response is unavailable");
    this.name = "TxlineHistoricalUnavailableError";
  }
}
export class TxlineMalformedResponseError extends Error {
  readonly reason = "MALFORMED_JSON" as const;
  constructor(
    public readonly status: number,
    public readonly endpointCategory: TxlineEndpointCategory,
    public readonly fixtureId?: string,
  ) {
    super("TxLINE returned malformed JSON");
    this.name = "TxlineMalformedResponseError";
  }
}
export class TxlineProofResponseError extends Error {
  constructor(public readonly category: string) {
    super("TxLINE proof response failed validation");
    this.name = "TxlineProofResponseError";
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
const fixtureRecord = z.object({
  Ts: z.number().int().optional(),
  FixtureId: z.union([z.string().min(1), z.number().int().safe()]),
  StartTime: z.union([z.number(), z.string()]),
  Competition: z.string().optional(),
  CompetitionId: z.number().int().optional(),
  FixtureGroupId: z.number().int().optional(),
  Participant1Id: z.number().int().optional(),
  Participant1: z.string().trim().min(1),
  Participant2Id: z.number().int().optional(),
  Participant2: z.string().trim().min(1),
  Participant1IsHome: z.boolean(),
  GameState: z.union([z.string(), z.number()]).optional(),
  gameState: z.union([z.string(), z.number()]).optional(),
});
const snapshotEnvelope = z.union([
  z.array(z.unknown()),
  z.object({ fixtures: z.array(z.unknown()) }),
  z.object({ Fixtures: z.array(z.unknown()) }),
]);
function recordsFrom(value: z.infer<typeof snapshotEnvelope>): unknown[] {
  return Array.isArray(value) ? value : "fixtures" in value ? value.fixtures : value.Fixtures;
}
function statusOf(value: string | number | undefined): FixtureStatus {
  if (value === undefined) return "UNKNOWN";
  const state = String(value);
  return state === "1" ? "SCHEDULED" : state === "6" ? "CANCELLED" : "UNKNOWN";
}

const MIN_FIXTURE_TIME_MS = Date.UTC(2000, 0, 1);
const MAX_FIXTURE_TIME_MS = Date.UTC(2100, 11, 31, 23, 59, 59, 999);
const isoDateTime = z.string().datetime({ offset: true });

export function normalizeFixtureStartTime(value: number | string): Date | undefined {
  let milliseconds: number;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) return undefined;
    if (value >= MIN_FIXTURE_TIME_MS && value <= MAX_FIXTURE_TIME_MS) {
      milliseconds = value;
    } else {
      const minimumSeconds = Math.ceil(MIN_FIXTURE_TIME_MS / 1_000);
      const maximumSeconds = Math.floor(MAX_FIXTURE_TIME_MS / 1_000);
      if (value < minimumSeconds || value > maximumSeconds) return undefined;
      milliseconds = value * 1_000;
    }
  } else {
    if (!isoDateTime.safeParse(value).success) return undefined;
    milliseconds = Date.parse(value);
  }

  const date = new Date(milliseconds);
  return Number.isFinite(date.getTime()) &&
    date.getTime() >= MIN_FIXTURE_TIME_MS &&
    date.getTime() <= MAX_FIXTURE_TIME_MS
    ? date
    : undefined;
}

function rejectionReason(record: unknown): FixtureRejectionReason {
  if (!record || typeof record !== "object" || Array.isArray(record)) return "INVALID_RECORD";
  const value = record as Record<string, unknown>;
  if (!(
    (typeof value.FixtureId === "string" && value.FixtureId.length > 0) ||
    (typeof value.FixtureId === "number" && Number.isSafeInteger(value.FixtureId))
  ))
    return "INVALID_FIXTURE_ID";
  if (
    typeof value.Participant1 !== "string" ||
    value.Participant1.trim().length === 0 ||
    typeof value.Participant2 !== "string" ||
    value.Participant2.trim().length === 0
  )
    return "MISSING_PARTICIPANT";
  if (
    (typeof value.StartTime !== "number" && typeof value.StartTime !== "string") ||
    normalizeFixtureStartTime(value.StartTime) === undefined
  )
    return "INVALID_START_TIME";
  return "INVALID_RECORD";
}

export function normalizeSnapshot(payload: unknown): FixtureSnapshotResult {
  const records = recordsFrom(snapshotEnvelope.parse(payload));
  const fixtures: NormalizedFixture[] = [];
  let rejected = 0;
  const rejectionReasons: Partial<Record<FixtureRejectionReason, number>> = {};
  for (const record of records) {
    const parsed = fixtureRecord.safeParse(record);
    if (!parsed.success) {
      rejected++;
      const reason = rejectionReason(record);
      rejectionReasons[reason] = (rejectionReasons[reason] ?? 0) + 1;
      continue;
    }
    const value = parsed.data;
    const startsAt = normalizeFixtureStartTime(value.StartTime);
    if (!startsAt) {
      rejected++;
      rejectionReasons.INVALID_START_TIME = (rejectionReasons.INVALID_START_TIME ?? 0) + 1;
      continue;
    }
    const state = value.GameState ?? value.gameState;
    fixtures.push({
      sourceId: String(value.FixtureId),
      homeTeam: value.Participant1IsHome ? value.Participant1 : value.Participant2,
      awayTeam: value.Participant1IsHome ? value.Participant2 : value.Participant1,
      startsAt,
      status: statusOf(state),
      sourceMode: "LIVE",
      participant1Name: value.Participant1,
      participant2Name: value.Participant2,
      participant1IsHome: value.Participant1IsHome,
    });
  }
  return { fixtures, fetched: records.length, rejected, rejectionReasons };
}

class GuestJwtProvider {
  private token: string | undefined;
  private refreshPromise: Promise<string> | undefined;
  constructor(
    private readonly request: (
      path: string,
      init: RequestInit,
      category: TxlineEndpointCategory,
    ) => Promise<Response>,
    private readonly retryDelayMs: number,
  ) {}
  get(force = false): Promise<string> {
    if (!force && this.token) return Promise.resolve(this.token);
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = this.acquire().finally(() => {
      this.refreshPromise = undefined;
    });
    return this.refreshPromise;
  }
  private async acquire(): Promise<string> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await this.request("/auth/guest/start", { method: "POST" }, "GUEST_AUTH");
        if (!response.ok) throw errorFor(response);
        const parsed = guestResponse.parse(await response.json());
        const token = "token" in parsed ? parsed.token : parsed.jwt;
        this.token = token;
        return token;
      } catch (error) {
        if (!(error instanceof TxlineRequestTimeoutError) || attempt === 1) throw error;
        await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs));
      }
    }
    throw new TxlineRequestTimeoutError("GUEST_AUTH");
  }
}
function errorFor(response: Response): TxlineHttpError {
  if (response.status === 403) return new TxlineSubscriptionError();
  if (response.status === 429) return new TxlineRateLimitError(response.headers.get("retry-after"));
  return new TxlineHttpError(response.status);
}
export async function readTxlineJson(
  response: Response,
  context: Readonly<{ endpointCategory: TxlineEndpointCategory; fixtureId?: string }>,
): Promise<unknown> {
  if (!response.ok) throw errorFor(response);
  if (response.status === 204 && context.endpointCategory === "SCORE_HISTORY") {
    throw new TxlineHistoricalUnavailableError(context.fixtureId ?? "", 204, "NO_CONTENT");
  }
  const body = await response.text();
  if (!body.trim()) {
    if (context.endpointCategory === "SCORE_HISTORY") {
      throw new TxlineHistoricalUnavailableError(
        context.fixtureId ?? "",
        response.status,
        "EMPTY_BODY",
      );
    }
    throw new TxlineMalformedResponseError(
      response.status,
      context.endpointCategory,
      context.fixtureId,
    );
  }
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new TxlineMalformedResponseError(
      response.status,
      context.endpointCategory,
      context.fixtureId,
    );
  }
}
export function createHttpTxlineClient(
  config: TxlineConfig,
  options: Readonly<{
    fetch?: typeof fetch;
    testOrigin?: string;
    guestRetryDelayMs?: number;
  }> = {},
): TxlineClient {
  const fetcher = options.fetch ?? fetch;
  const origin = options.testOrigin ?? TXLINE_ORIGINS[config.network];
  const request = async (
    path: string,
    init: RequestInit,
    endpointCategory: TxlineEndpointCategory,
  ): Promise<Response> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      return await fetcher(`${origin}${path}`, { ...init, signal: controller.signal });
    } catch (error) {
      if (
        (error instanceof DOMException && error.name === "AbortError") ||
        (error instanceof Error && error.name === "AbortError")
      )
        throw new TxlineRequestTimeoutError(endpointCategory);
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  };
  const jwt = new GuestJwtProvider(
    request,
    Math.max(10, Math.min(options.guestRetryDelayMs ?? 100, 500)),
  );
  const authenticated = async (
    path: string,
    endpointCategory: TxlineEndpointCategory,
  ): Promise<Response> => {
    let token = await jwt.get();
    let response = await request(
      path,
      { headers: { Authorization: `Bearer ${token}`, "X-Api-Token": config.apiToken } },
      endpointCategory,
    );
    if (response.status === 401) {
      token = await jwt.get(true);
      response = await request(
        path,
        { headers: { Authorization: `Bearer ${token}`, "X-Api-Token": config.apiToken } },
        endpointCategory,
      );
    }
    if (!response.ok) throw errorFor(response);
    return response;
  };
  return {
    snapshots: {
      getFixtures: async () => {
        const response = await authenticated("/api/fixtures/snapshot", "FIXTURE_SNAPSHOT");
        return normalizeSnapshot(
          await readTxlineJson(response, { endpointCategory: "FIXTURE_SNAPSHOT" }),
        );
      },
    },
    stream: { subscribe: () => Promise.reject(new LiveTxlineClientNotConfiguredError()) },
    getScoresSnapshot: async (fixtureId, asOf) => {
      const response = await authenticated(
        `/api/scores/snapshot/${encodeURIComponent(fixtureId)}${asOf ? `?asOf=${encodeURIComponent(asOf.toISOString())}` : ""}`,
        "SCORE_SNAPSHOT",
      );
      return normalizeScoreBatch(
        await readTxlineJson(response, { endpointCategory: "SCORE_SNAPSHOT", fixtureId }),
      );
    },
    getHistoricalScores: async (fixtureId) => {
      const response = await authenticated(
        `/api/scores/historical/${encodeURIComponent(fixtureId)}`,
        "SCORE_HISTORY",
      );
      return normalizeScoreBatch(
        await readTxlineJson(response, { endpointCategory: "SCORE_HISTORY", fixtureId }),
      );
    },
    getScoreStatValidation: async (input) => {
      const requestInput = validateScoreStatRequest(input);
      const query = new URLSearchParams({
        fixtureId: requestInput.fixtureId,
        seq: String(requestInput.sequence),
        statKeys: requestInput.statKeys.join(","),
      });
      const response = await authenticated(`/api/scores/stat-validation?${query}`, "PROOF_FETCH");
      const payload = await readTxlineJson(response, {
        endpointCategory: "PROOF_FETCH",
        fixtureId: requestInput.fixtureId,
      });
      try {
        return normalizeScoreStatProof(payload, requestInput, config.network);
      } catch (error) {
        const issue = error instanceof z.ZodError ? error.issues[0] : undefined;
        const category = issue
          ? `SCHEMA_${issue.path.join("_") || "ROOT"}_${issue.code}${
              issue.code === "unrecognized_keys"
                ? `_${issue.keys.map((key) => key.replace(/[^A-Za-z0-9]/g, "")).join("_")}`
                : ""
            }`
          : error instanceof Error && /^[A-Z][A-Z0-9_]{2,80}$/.test(error.message)
            ? error.message
            : "MALFORMED_RESPONSE";
        throw new TxlineProofResponseError(category);
      }
    },
    openScoresStream: async (streamOptions = {}) => {
      let token = await jwt.get();
      const connect = (value: string) =>
        request(
          "/api/scores/stream",
          {
            headers: {
              Authorization: `Bearer ${value}`,
              "X-Api-Token": config.apiToken,
              Accept: "text/event-stream",
              "Cache-Control": "no-cache",
              ...(streamOptions.lastEventId ? { "Last-Event-ID": streamOptions.lastEventId } : {}),
            },
            ...(streamOptions.signal ? { signal: streamOptions.signal } : {}),
          },
          "SCORE_STREAM",
        );
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
      getFixtures: () =>
        Promise.resolve({ fixtures: [fixture], fetched: 1, rejected: 0, rejectionReasons: {} }),
    },
    stream: { subscribe: () => Promise.resolve(() => Promise.resolve()) },
    getScoresSnapshot: () =>
      Promise.resolve({ scores: [], fetched: 0, rejected: 0, rejectionReasons: {} }),
    getHistoricalScores: () =>
      Promise.resolve({ scores: [], fetched: 0, rejected: 0, rejectionReasons: {} }),
    getScoreStatValidation: () => Promise.reject(new LiveTxlineClientNotConfiguredError()),
    openScoresStream: () => Promise.resolve((async function* () {})()),
  };
}
