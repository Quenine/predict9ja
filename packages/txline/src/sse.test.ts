import { describe, expect, it } from "vitest";
import { parseSse } from "./sse";
const body = (chunks: string[]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
      controller.close();
    },
  });
describe("SSE parser", () => {
  it("handles chunks, CRLF, multiline data, id, event and retry", async () => {
    const values = [];
    for await (const event of parseSse(
      body(["id: 9\r\nevent: score\r\ndata: first", " line\r\ndata: two\r\nretry: 2000\r\n\r\n"]),
    ))
      values.push(event);
    expect(values).toEqual([{ id: "9", event: "score", data: "first line\ntwo", retry: 2000 }]);
  });
  it("ignores comments and emits a final buffered event", async () => {
    const values = [];
    for await (const event of parseSse(body([": heartbeat\ndata: final"]))) values.push(event);
    expect(values).toEqual([{ data: "final" }]);
  });
  it("rejects a missing body", async () => {
    const iterator = parseSse(null);
    await expect(iterator.next()).rejects.toThrow("no body");
  });
  it("supports abort", async () => {
    const controller = new AbortController();
    controller.abort();
    const values = [];
    for await (const event of parseSse(body(["data: ignored\n\n"]), controller.signal))
      values.push(event);
    expect(values).toEqual([]);
  });
});
