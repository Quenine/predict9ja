import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import "./globals.css";
import { PublicNav } from "./public-nav";
export const metadata: Metadata = {
  metadataBase: new URL("https://predict9ja-web.vercel.app"),
  title: { default: "Predict9ja | Predict, replay and verify", template: "%s | Predict9ja" },
  description: "Predict the match. Replay real TxLINE updates. Verify how the result was settled.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Predict9ja",
    title: "Predict the match. Replay the action. Verify the result.",
    description:
      "A TxLINE-powered prediction and verifiable-resolution experience using demo credits.",
  },
  twitter: {
    card: "summary",
    title: "Predict9ja | Predict, replay and verify",
    description:
      "TxLINE match truth with transparent prediction, resolution, accounting and evidence.",
  },
  icons: { icon: "/icon.svg" },
};
export default function Layout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="notice" role="status">
          Demo mode — credits have no cash value. No deposits or withdrawals.
        </div>
        <header className="shell nav">
          <Link href="/" className="brand">
            Predict<span>9ja</span>
          </Link>
          <PublicNav />
        </header>
        {children}
        <footer className="shell footer">
          <p>
            <strong>Predict9ja</strong> · <span className="muted">Powered by TxLINE devnet</span>
          </p>
          <nav aria-label="Footer">
            <Link href="/partners">For Partners</Link>
            <a href="https://github.com/Quenine/predict9ja">GitHub</a>
            <span>Built with TxLINE sports data</span>
          </nav>
        </footer>
      </body>
    </html>
  );
}
