import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { SiteShell } from "@/components/site-shell";
export default function NotFound() {
  return (
    <SiteShell>
      <section className="site-width site-not-found">
        <p className="site-eyebrow">404 / A WRONG TURN</p>
        <h1 className="site-display">
          Let’s find
          <br />a better exit.
        </h1>
        <p>This page isn’t here. Your next move is.</p>
        <Link href="/" className="site-button site-button-primary">
          Back to Closeout <ArrowUpRight size={17} aria-hidden="true" />
        </Link>
      </section>
    </SiteShell>
  );
}
