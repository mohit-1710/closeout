import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, LockKeyhole, MoveUpRight, ScanLine } from "lucide-react";
import { SiteShell } from "@/components/site-shell";
import { ExitPreview } from "@/components/exit-preview";

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default function Home() {
  return (
    <SiteShell>
      <section className="home-hero site-width">
        <div className="hero-copy">
          <p className="site-eyebrow">
            <span className="site-status-dot" /> AN EXIT PLANNER FOR POLYMARKET
          </p>
          <h1>
            Your position.
            <br />
            <em>Your exit plan.</em>
          </h1>
          <p className="hero-description">
            Bring your Polymarket positions. Choose how much to sell, see what buyers could take,
            and understand the fees and unsold shares before you decide.
          </p>
          <div className="hero-actions">
            <Link href="/app" prefetch={false} className="site-button site-button-primary">
              Find my positions <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
            <Link
              href="/app?mode=example"
              prefetch={false}
              className="site-button site-button-secondary"
            >
              Walk through an example <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
          <p className="hero-footnote">
            <Check size={14} aria-hidden="true" /> Connect your wallet or paste a public profile. No
            trade is placed.
          </p>
        </div>
        <div className="hero-visual">
          <div className="hero-visual-label">
            <span>WHAT YOUR PLAN WILL SHOW</span>
            <span>A FICTIONAL EXAMPLE</span>
          </div>
          <ExitPreview />
          <p className="hero-visual-caption">
            <span aria-hidden="true">↳</span> Choose a minimum price. See how many shares could
            sell.
          </p>
        </div>
      </section>
      <div className="home-proof-strip">
        <div className="site-width">
          <p>One plan. The details that matter.</p>
          <span>
            <ScanLine size={16} aria-hidden="true" /> Live order-book depth
          </span>
          <span>
            <LockKeyhole size={16} aria-hidden="true" /> Your wallet stays yours
          </span>
          <span>
            <Check size={16} aria-hidden="true" /> Clear partial-fill estimates
          </span>
        </div>
      </div>
      <section className="home-journey site-width">
        <div className="section-heading">
          <div>
            <p className="site-eyebrow">A CLEAR PATH FROM THE FIRST CLICK</p>
            <h2 className="site-display">
              Start with what you hold.
              <br />
              See your next step.
            </h2>
          </div>
          <Link href="/how-it-works" className="site-text-link">
            How it works <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>
        <div className="journey-list">
          <article>
            <span>01</span>
            <div>
              <h3>Bring your portfolio</h3>
              <p>
                Connect the wallet you use with Polymarket and we’ll find its public profile. Or
                paste a profile link to explore without connecting.
              </p>
            </div>
            <MoveUpRight aria-hidden="true" size={22} />
          </article>
          <article>
            <span>02</span>
            <div>
              <h3>Choose the position to exit</h3>
              <p>
                Pick from the positions in that portfolio. Your plan starts with its actual share
                quantity and the current best bid. Adjust the amount and minimum price yourself.
              </p>
            </div>
            <MoveUpRight aria-hidden="true" size={22} />
          </article>
          <article>
            <span>03</span>
            <div>
              <h3>See the result before authorizing</h3>
              <p>
                See estimated proceeds, fees and what would stay unsold. Review with the owner
                wallet when you’re ready; an actual sell needs a separate confirmation.
              </p>
            </div>
            <MoveUpRight aria-hidden="true" size={22} />
          </article>
        </div>
      </section>
      <section className="home-trust site-width">
        <div className="trust-mark" aria-hidden="true">
          <LockKeyhole size={28} strokeWidth={1.4} />
        </div>
        <div>
          <p className="site-eyebrow">CLARITY ALSO MEANS KNOWING THE LIMITS</p>
          <h2>Explore first. Authorize deliberately.</h2>
          <p>
            Closeout never needs your seed phrase. Browsing is read-only; signing happens in your
            wallet. The planner is available now. Live execution is an early feature and has not yet
            been verified with a real trade.
          </p>
          <Link href="/how-it-works#before-you-trade" className="site-text-link">
            What to know before trading <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>
      <section className="home-final-cta">
        <div className="site-width">
          <p className="site-eyebrow">YOUR NEXT MOVE STARTS HERE</p>
          <h2 className="site-display">
            See what your position
            <br />
            <em>could sell for.</em>
          </h2>
          <div className="hero-actions">
            <Link href="/app" prefetch={false} className="site-button site-button-primary">
              Find my positions <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
            <Link href="/app?mode=example" prefetch={false} className="site-text-link">
              Try a sample position <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
          <p className="hero-footnote">
            No position to hand? The sample takes you through the same steps with fictional data.
          </p>
        </div>
      </section>
    </SiteShell>
  );
}
