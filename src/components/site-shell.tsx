import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { CloseoutLogo } from "./brand";
import { SiteNavigation } from "./site-navigation";
import "./site.css";

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="site-shell">
      <a className="site-skip" href="#main-content">
        Skip to content
      </a>
      <SiteNavigation />
      <main id="main-content">{children}</main>
      <footer className="site-footer">
        <div className="site-width">
          <div className="site-footer-top">
            <div>
              <Link href="/" aria-label="Closeout home" className="site-brand">
                <CloseoutLogo />
              </Link>
              <p>
                A little more clarity.
                <br />
                Before your next move.
              </p>
            </div>
            <div className="site-footer-links">
              <span>Explore</span>
              <Link href="/product">The product</Link>
              <Link href="/how-it-works">How it works</Link>
              <Link href="/how-it-works#questions">Questions, answered</Link>
            </div>
            <div className="site-footer-links">
              <span>Take a look</span>
              <Link href="/app" prefetch={false}>
                Open the planner <ArrowUpRight size={13} aria-hidden="true" />
              </Link>
              <Link href="/app?mode=example" prefetch={false}>
                Try an example <ArrowUpRight size={13} aria-hidden="true" />
              </Link>
              <a href="https://github.com/mohit-1710/closeout" target="_blank" rel="noreferrer">
                View source <ArrowUpRight size={13} aria-hidden="true" />
              </a>
            </div>
          </div>
          <div className="site-footer-bottom">
            <span>© 2026 Closeout</span>
            <p>
              Independent software for Polymarket traders. Not affiliated with Polymarket. Quotes
              are estimates; fills are never guaranteed.
            </p>
            <span className="site-footer-network">
              <span /> Built for Polygon
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
