export type ReplayClock = Readonly<{
  sleep(milliseconds: number, signal: AbortSignal): Promise<void>;
}>;
export type ReplayItem = Readonly<{ sequence: number; timestamp: Date }>;
export async function replayOrdered(
  items: readonly ReplayItem[],
  speed: number,
  signal: AbortSignal,
  apply: (item: ReplayItem) => Promise<void>,
  clock: ReplayClock = {
    sleep: (milliseconds, abortSignal) =>
      new Promise((resolve) => {
        const timer = setTimeout(resolve, milliseconds);
        abortSignal.addEventListener(
          "abort",
          () => {
            clearTimeout(timer);
            resolve();
          },
          { once: true },
        );
      }),
  },
) {
  if (!(speed > 0)) throw new Error("Replay speed must be positive");
  let previous: Date | undefined;
  let processed = 0;
  for (const item of [...items].sort((a, b) => a.sequence - b.sequence)) {
    if (signal.aborted) break;
    if (previous)
      await clock.sleep(
        Math.max(0, (item.timestamp.getTime() - previous.getTime()) / speed),
        signal,
      );
    if (signal.aborted) break;
    await apply(item);
    previous = item.timestamp;
    processed++;
  }
  return { processed, cancelled: signal.aborted };
}
