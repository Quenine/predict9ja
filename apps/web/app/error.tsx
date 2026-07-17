"use client";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="shell state-page">
      <div className="eyebrow">Safe recovery</div>
      <h1>Something interrupted this view.</h1>
      <p className="lead">
        No credentials or provider payloads were exposed. Try loading the page again.
      </p>
      <button className="button primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
