import Link from "next/link";
export default function NotFound() {
  return (
    <main className="shell state-page">
      <div className="eyebrow">404</div>
      <h1>That page is offside.</h1>
      <p className="lead">The match, receipt or page may no longer be available.</p>
      <div className="actions">
        <Link className="button primary" href="/arena">
          Explore matches
        </Link>
        <Link className="button" href="/judge?mode=replay">
          Run verified replay
        </Link>
      </div>
    </main>
  );
}
