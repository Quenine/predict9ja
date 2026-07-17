"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
const links = [
  ["/arena", "Matches"],
  ["/judge", "Replay & Predict"],
  ["/portfolio", "My Picks"],
] as const;
export function PublicNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <div className="public-nav">
      <button
        aria-controls="primary-navigation"
        aria-expanded={open}
        className="nav-toggle"
        onClick={() => setOpen((value) => !value)}
      >
        Menu
      </button>
      <nav
        aria-label="Primary"
        className={`nav-links ${open ? "open" : ""}`}
        id="primary-navigation"
      >
        {links.map(([href, label]) => (
          <Link
            aria-current={pathname.startsWith(href) ? "page" : undefined}
            key={href}
            href={href}
            onClick={() => setOpen(false)}
          >
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
