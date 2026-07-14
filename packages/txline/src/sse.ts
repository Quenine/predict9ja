export type SseEvent = Readonly<{ data: string; event?: string; id?: string; retry?: number }>;
export async function* parseSse(
  body: ReadableStream<Uint8Array> | null,
  signal?: AbortSignal,
): AsyncGenerator<SseEvent> {
  if (!body) throw new Error("TxLINE stream response has no body");
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let data: string[] = [];
  let event: string | undefined;
  let id: string | undefined;
  let retry: number | undefined;
  const emit = (): SseEvent | null =>
    data.length
      ? {
          data: data.join("\n"),
          ...(event ? { event } : {}),
          ...(id !== undefined ? { id } : {}),
          ...(retry !== undefined ? { retry } : {}),
        }
      : null;
  const reset = () => {
    data = [];
    event = undefined;
    retry = undefined;
  };
  const line = (value: string): SseEvent | null => {
    if (value === "") {
      const result = emit();
      reset();
      return result;
    }
    if (value.startsWith(":")) return null;
    const colon = value.indexOf(":");
    const field = colon < 0 ? value : value.slice(0, colon);
    let fieldValue = colon < 0 ? "" : value.slice(colon + 1);
    if (fieldValue.startsWith(" ")) fieldValue = fieldValue.slice(1);
    if (field === "data") data.push(fieldValue);
    else if (field === "event") event = fieldValue;
    else if (field === "id" && !fieldValue.includes("\0")) id = fieldValue;
    else if (field === "retry" && /^\d+$/.test(fieldValue)) retry = Number(fieldValue);
    return null;
  };
  const abort = () => void reader.cancel();
  signal?.addEventListener("abort", abort, { once: true });
  try {
    while (!signal?.aborted) {
      const read = await reader.read();
      buffer += decoder.decode(read.value, { stream: !read.done });
      const parts = buffer.split(/\r\n|\r|\n/);
      buffer = parts.pop() ?? "";
      for (const item of parts) {
        const result = line(item);
        if (result) yield result;
      }
      if (read.done) break;
    }
    if (buffer) {
      const result = line(buffer);
      if (result) yield result;
    }
    const final = emit();
    if (final) yield final;
  } finally {
    signal?.removeEventListener("abort", abort);
    reader.releaseLock();
  }
}
