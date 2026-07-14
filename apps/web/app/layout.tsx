import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Predict9ja World Cup Arena", template: "%s | Predict9ja" },
  description: "Live predictions. Verifiable results.",
};
const links = [
  ["/arena", "Arena"],
  ["/portfolio", "Portfolio"],
  ["/judge", "Judge"],
  ["/admin", "Admin"],
] as const;

export default function Layout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="notice" role="status">
          Development preview — all fixtures, markets and credits shown are synthetic.
        </div>
        <header className="shell nav">
          <Link href="/" className="brand">
            Predict<span>9ja</span>
          </Link>
          <nav aria-label="Primary" className="nav-links">
            {links.map(([href, label]) => (
              <Link key={href} href={href}>
                {label}
              </Link>
            ))}
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
