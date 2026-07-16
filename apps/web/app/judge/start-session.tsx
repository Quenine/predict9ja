"use client";
import { useState } from "react";

export function StartSession() {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function start() {
    setPending(true);
    setMessage("Creating isolated demo session…");
    try {
      const response = await fetch("/api/demo/session", { method: "POST" });
      const body: unknown = await response.json().catch(() => null);
      const balance =
        typeof body === "object" && body !== null && "balance" in body ? body.balance : null;
      setMessage(
        response.ok && typeof balance === "number"
          ? `Session ready. Balance: ${balance} demo credits.`
          : "Session creation is temporarily unavailable.",
      );
    } catch {
      setMessage("Session creation is temporarily unavailable.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div>
      <button className="button primary" disabled={pending} onClick={() => void start()}>
        {pending ? "Starting…" : "Start / reset judge session"}
      </button>
      <p role="status" aria-live="polite">
        {message}
      </p>
    </div>
  );
}
