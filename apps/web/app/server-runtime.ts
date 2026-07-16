export type WebRuntimeErrorCode =
  "WEB_DATABASE_ENV_MISSING" | "DEMO_SESSION_SECRET_MISSING" | "DEMO_SESSION_SECRET_INVALID";

export class WebRuntimeEnvironmentError extends Error {
  constructor(public readonly code: WebRuntimeErrorCode) {
    super(code);
    this.name = "WebRuntimeEnvironmentError";
  }
}

type RuntimeEnvironment = Readonly<Record<string, string | undefined>>;

export function requireWebDatabaseEnvironment(environment: RuntimeEnvironment = process.env) {
  if (!environment.DATABASE_URL && !environment.PRISMA_ACCELERATE_URL)
    throw new WebRuntimeEnvironmentError("WEB_DATABASE_ENV_MISSING");
}

export function requireDemoSessionSecret(environment: RuntimeEnvironment = process.env) {
  const secret = environment.DEMO_SESSION_SECRET;
  if (!secret) throw new WebRuntimeEnvironmentError("DEMO_SESSION_SECRET_MISSING");
  if (secret.length < 16) throw new WebRuntimeEnvironmentError("DEMO_SESSION_SECRET_INVALID");
  return secret;
}

export function safeRuntimeCategory(error: unknown) {
  if (error instanceof WebRuntimeEnvironmentError) return error.code;
  return "DATABASE_UNAVAILABLE" as const;
}
