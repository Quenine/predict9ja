import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import "./globals.css";
import { PublicNav } from "./public-nav";

export const metadata: Metadata = {
  metadataBase: new URL("https://predict9ja-web.vercel.app"),
  title: {
    default: "Predict9ja | Verifiable football prediction settlement",
    template: "%s | Predict9ja",
  },
  description:
    "Predict9ja turns TxLINE match observations into deterministic prediction settlement with inspectable application receipts and verifiable source evidence.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Predict9ja",
    title: "Predict9ja | Verifiable football prediction settlement",
    description:
      "Replay real TxLINE observations, settle fictional demo-credit predictions deterministically and inspect verified source evidence.",
  },
  twitter: {
    card: "summary",
    title: "Predict9ja | Verifiable football prediction settlement",
    description: "TxLINE observations to deterministic settlement and inspectable evidence.",
  },
  icons: { icon: "/icon.svg" },
};

export default function Layout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="notice" role="status">
          Hackathon prototype — real TxLINE sports evidence; demo-credit markets and no real-value
          transactions.
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
            <strong>Predict9ja</strong> · Fictional demo credits only. No deposits, custody or
            real-value transactions.
          </p>
          <nav aria-label="Footer">
            <a href="https://github.com/Quenine/predict9ja">Public repository</a>
            <span>Built with TxLINE sports data</span>
          </nav>
        </footer>
      </body>
    </html>
  );
}
