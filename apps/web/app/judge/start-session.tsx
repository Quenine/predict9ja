"use client";
import { useState } from "react";
export function StartSession() {
  const [message, setMessage] = useState("");
  return (
    <button
      className="button primary"
      onClick={() =>
        void (async () => {
          const response = await fetch("/api/demo/session", { method: "POST" });
          setMessage(
            response.ok
              ? "Isolated session created with 10,000 demo credits. Open the synthetic fixture."
              : "Session creation failed.",
          );
        })()
      }
    >
      Start / reset judge session
      <span className="sr-only" role="status">
        {message}
      </span>
    </button>
  );
}
