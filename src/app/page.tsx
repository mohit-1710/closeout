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
            <span className="site-status-dot" /> FOR PREDICTION MARKET TRADERS
          </p>
          <h1>
            Know your exit.
            <br />
            <em>Before you sign.</em>
          </h1>
          <p className="hero-description">
            The market price tells one story. Your position tells another. See what could sell, what
            fees take, and what stays yours.
          </p>
          <div className="hero-actions">
            <Link href="/app" prefetch={false} className="site-button site-button-primary">
              Plan your exit <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
            <Link
              href="/app?mode=example"
              prefetch={false}
              className="site-button site-button-secondary"
            >
              Try an example <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
          <p className="hero-footnote">
            <Check size={14} aria-hidden="true" /> No wallet needed to explore
          </p>
        </div>
        <div className="hero-visual">
          <div className="hero-visual-label">
            <span>THE EXIT, IN FOCUS</span>
            <span>250 SHARES</span>
          </div>
          <ExitPreview />
          <p className="hero-visual-caption">
            <span aria-hidden="true">↳</span> Change the floor. See what changes.
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
      <section className="home-perspective site-width">
        <div className="perspective-heading">
          <p className="site-eyebrow">A PRICE ISN’T AN EXIT PLAN</p>
          <h2 className="site-display">
            A small position.
            <br />A bigger question.
          </h2>
          <Link href="/product" className="site-text-link">
            Meet Closeout <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>
        <div className="perspective-body">
          <p className="perspective-lead">
            “If I sell now,
            <br />
            <em>what actually happens?”</em>
          </p>
          <p>
            A quoted price doesn’t tell you whether there are enough buyers for your shares. Or
            what’s left after fees. Or whether part of your position will remain open.
          </p>
          <p>
            Closeout puts those answers in one exit plan, so you can make the decision with the
            whole picture.
          </p>
        </div>
      </section>
      <section className="home-control-section">
        <div className="site-width">
          <div className="section-heading">
            <div>
              <p className="site-eyebrow">SET THE TERMS OF YOUR EXIT</p>
              <h2 className="site-display">
                More clarity.
                <br />
                <em>More control.</em>
              </h2>
            </div>
            <p>
              Start with the position. Decide the price.
              <br />
              Understand the trade-off before you act.
            </p>
          </div>
          <div className="control-grid">
            <article className="control-main">
              <span className="control-index">01 / THE PRICE FLOOR</span>
              <h3>Draw your line.</h3>
              <p>
                Set the minimum price you’re willing to accept for each share. See exactly how much
                buying interest sits above it.
              </p>
              <div
                className="floor-illustration"
                role="img"
                aria-label="Illustration of bid levels above and below a minimum price floor"
              >
                <div>
                  <span>0.64</span>
                  <i style={{ width: "41%" }} />
                </div>
                <div>
                  <span>0.62</span>
                  <i style={{ width: "60%" }} />
                </div>
                <div className="floor-rule">
                  <span>0.60</span>
                  <b>Your floor</b>
                  <ArrowRight size={14} aria-hidden="true" />
                </div>
                <div className="below-floor">
                  <span>0.58</span>
                  <i style={{ width: "76%" }} />
                </div>
                <div className="below-floor">
                  <span>0.56</span>
                  <i style={{ width: "89%" }} />
                </div>
              </div>
            </article>
            <article className="control-side">
              <div>
                <span className="control-index">02 / THE FILL CHOICE</span>
                <h3>
                  Some now.
                  <br />
                  Or all together.
                </h3>
                <p>
                  Choose a partial exit at your floor, or require the full amount to fill. The
                  unsold shares stay visible in your plan.
                </p>
              </div>
              <div className="fill-illustration">
                <span className="fill-label">An example partial exit</span>
                <div className="fill-bar">
                  <span />
                  <span />
                </div>
                <div>
                  <strong>
                    140 <span>could fill</span>
                  </strong>
                  <strong>
                    110 <span>remain</span>
                  </strong>
                </div>
              </div>
            </article>
            <article className="control-bottom">
              <div>
                <span className="control-index">03 / THE WHOLE PICTURE</span>
                <h3>
                  The fees. The remainder.
                  <br />
                  Right in front of you.
                </h3>
              </div>
              <p>
                Review gross proceeds, estimated venue fees, and shares left unsold together. A
                fresh quote gives you one more look before authorization.
              </p>
              <Link
                href="/product"
                className="site-round-link"
                aria-label="Explore all Closeout features"
              >
                <ArrowUpRight size={24} aria-hidden="true" />
              </Link>
            </article>
          </div>
        </div>
      </section>
      <section className="home-journey site-width">
        <div className="section-heading">
          <div>
            <p className="site-eyebrow">FROM POSITION TO PLAN</p>
            <h2 className="site-display">
              Take a look.
              <br />
              Then make your move.
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
              <h3>Find your market</h3>
              <p>
                Explore current markets and inspect the bids for your outcome. You can start without
                connecting a wallet.
              </p>
            </div>
            <MoveUpRight aria-hidden="true" size={22} />
          </article>
          <article>
            <span>02</span>
            <div>
              <h3>Build your exit plan</h3>
              <p>
                Enter your shares, set your floor, and compare a partial exit with an all-or-nothing
                order.
              </p>
            </div>
            <MoveUpRight aria-hidden="true" size={22} />
          </article>
          <article>
            <span>03</span>
            <div>
              <h3>Review before you decide</h3>
              <p>
                See the estimate and remainder in one place. Your existing account’s owner
                authorizes any real order.
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
            Give your exit
            <br />
            <em>a little more thought.</em>
          </h2>
          <div className="hero-actions">
            <Link href="/app" prefetch={false} className="site-button site-button-primary">
              Open the exit planner <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
            <Link href="/app?mode=example" prefetch={false} className="site-text-link">
              Take the example for a spin <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
          <p className="hero-footnote">Start with a market. No sign-up required to explore.</p>
        </div>
      </section>
    </SiteShell>
  );
}
