import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownRight, ArrowRight, Check, Minus } from "lucide-react";
import { SiteShell } from "@/components/site-shell";
import "@/components/info-pages.css";

export const metadata: Metadata = {
  title: "Product",
  description:
    "Understand how available bids, a minimum price per share and fees shape your prediction-market exit. Explore the Closeout planner.",
};

// The same fictional Atlas book used by the opt-in Example workspace.
const bids = [
  { price: "0.62", shares: 30, cumulative: 30, eligible: true },
  { price: "0.61", shares: 45, cumulative: 75, eligible: true },
  { price: "0.60", shares: 65, cumulative: 140, eligible: true },
  { price: "0.58", shares: 90, cumulative: 230, eligible: false },
  { price: "0.56", shares: 110, cumulative: 340, eligible: false },
];

export default function ProductPage() {
  return (
    <SiteShell>
      <article className="info-page">
        <header className="site-width info-hero info-hero-product">
          <div>
            <p className="site-eyebrow">The exit planner</p>
            <h1 className="site-display info-heading">
              Know what your exit <em>could return.</em>
            </h1>
            <p className="info-lead">
              A position has a price. An exit needs buyers. See what the current bids can take
              before you choose to sell.
            </p>
            <div className="info-actions">
              <Link href="/app" prefetch={false} className="site-button site-button-primary">
                Find my positions <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <Link href="/app?mode=example" prefetch={false} className="site-text-link">
                Try an example <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <p className="info-small site-muted">
              Import a public profile and plan without connecting a wallet.
            </p>
          </div>
          <div className="info-position-illustration">
            <div className="info-illustration-label">
              <span className="info-example-dot" />
              Illustrative example · no funds move
            </div>
            <p className="info-market-name">
              Will the Atlas mission launch before the end of the month?
            </p>
            <div className="info-position-amount">
              <span>Sell Yes</span>
              <strong>
                250 <small>shares</small>
              </strong>
            </div>
            <div
              className="info-fill-bar"
              role="img"
              aria-label="140 of 250 shares could fill; 110 would remain unsold at a 0.60 pUSD per share floor."
            >
              <span />
              <span />
            </div>
            <div className="info-fill-legend">
              <div>
                <span>
                  <i className="info-key-fill" />
                  Could fill
                </span>
                <strong>
                  140 <small>shares</small>
                </strong>
              </div>
              <div>
                <span>
                  <i className="info-key-unsold" />
                  Left unsold
                </span>
                <strong>
                  110 <small>shares</small>
                </strong>
              </div>
            </div>
            <div className="info-illustration-foot">
              <span>Minimum price / share</span>
              <strong>
                0.60 <small>pUSD</small>
              </strong>
            </div>
          </div>
        </header>

        <section className="info-section info-tinted" aria-labelledby="depth-heading">
          <div className="site-width info-split">
            <div className="info-section-copy">
              <p className="site-eyebrow">01 / Available depth</p>
              <h2 id="depth-heading" className="info-section-heading">
                The price is only
                <br />
                part of the exit.
              </h2>
              <p>
                Your best bid might cover only a fraction of your position. Closeout works down the
                available bids and stops at your minimum price.
              </p>
              <p>
                Set a floor of 0.60 pUSD per share, and only bids at 0.60 or higher count toward the
                plan.
              </p>
              <p className="info-inline-definition">
                <ArrowDownRight size={20} aria-hidden="true" />
                The floor is a gross price per share, not a guaranteed total after fees.
              </p>
            </div>
            <figure className="info-book">
              <figcaption>
                <strong>A 250-share exit at a 0.60 floor</strong>
                <span>Illustrative bid excerpt · pUSD per share</span>
              </figcaption>
              <table>
                <thead>
                  <tr>
                    <th scope="col">Bid price</th>
                    <th scope="col">Shares</th>
                    <th scope="col">In your plan</th>
                  </tr>
                </thead>
                <tbody>
                  {bids.map((bid) => (
                    <tr
                      key={bid.price}
                      className={bid.eligible ? "info-bid-eligible" : "info-bid-excluded"}
                    >
                      <th scope="row">
                        <span className="info-bid-price">{bid.price}</span>
                        {bid.price === "0.60" && (
                          <span className="info-floor-label">Your floor</span>
                        )}
                      </th>
                      <td>
                        <span
                          className="info-bid-depth"
                          style={{ width: `${(bid.shares / 110) * 100}%` }}
                        />
                        <span className="info-bid-value">{bid.shares}</span>
                      </td>
                      <td>
                        {bid.eligible ? (
                          <>
                            <Check size={14} aria-hidden="true" />
                            <span>Included</span>
                          </>
                        ) : (
                          <>
                            <Minus size={14} aria-hidden="true" />
                            <span>Below floor</span>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="info-book-total">
                <span>Eligible shares in this snapshot</span>
                <strong>
                  140 <small>/ 250</small>
                </strong>
              </div>
              <p>Visible bids can change before an order is accepted.</p>
            </figure>
          </div>
        </section>

        <section className="site-width info-section" aria-labelledby="fill-heading">
          <div className="info-section-intro">
            <p className="site-eyebrow">02 / Your fill choice</p>
            <h2 id="fill-heading" className="info-section-heading">
              A smaller exit.
              <br />
              Or the whole position.
            </h2>
            <p>Choose what should happen when there aren’t enough buyers at your price.</p>
          </div>
          <div className="info-comparison">
            <div className="info-fill-choice">
              <p className="info-choice-label">FAK / Fill and kill</p>
              <h3>Sell available</h3>
              <p>
                Attempt the shares that can fill at or above your floor. Cancel the unmatched order
                remainder; unsold shares stay in your position.
              </p>
              <div className="info-choice-result">
                <strong>
                  140 <small>could fill</small>
                </strong>
                <span>110 shares remain unsold</span>
              </div>
            </div>
            <div className="info-fill-choice">
              <p className="info-choice-label">FOK / Fill or kill</p>
              <h3>All or nothing</h3>
              <p>
                Require the entire requested quantity to fill within the order’s conditions. The
                example has too little eligible depth for a 250-share exit.
              </p>
              <div className="info-choice-result">
                <strong>
                  250 <small>required</small>
                </strong>
                <span>Plan blocked at this depth</span>
              </div>
            </div>
          </div>
          <p className="info-small info-section-note">
            Both choices use the same fictional snapshot above. A preview does not reserve
            liquidity.
          </p>
        </section>

        <section className="info-section info-tinted" aria-labelledby="fees-heading">
          <div className="site-width info-split">
            <div className="info-section-copy">
              <p className="site-eyebrow">03 / Proceeds & fees</p>
              <h2 id="fees-heading" className="info-section-heading">
                See what goes into
                <br />
                the estimate.
              </h2>
              <p>
                Gross proceeds, the estimated venue fee and shares left unsold belong in the same
                decision. Closeout shows them together.
              </p>
              <p>
                The Closeout fee is currently zero. If the venue fee cannot be verified, the planner
                keeps it unknown and blocks submission.
              </p>
              <Link href="/how-it-works#fees" className="site-text-link">
                Understand the fee scope <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <div className="info-receipt">
              <div className="info-receipt-head">
                <span>Illustrative estimate</span>
                <span>Sell available</span>
              </div>
              <dl>
                <div>
                  <dt>Gross proceeds</dt>
                  <dd>
                    85.05 <span>pUSD</span>
                  </dd>
                </div>
                <div>
                  <dt>Estimated venue fee</dt>
                  <dd>
                    −1.67 <span>pUSD</span>
                  </dd>
                </div>
                <div>
                  <dt>Closeout fee</dt>
                  <dd>
                    0.00 <span>pUSD</span>
                  </dd>
                </div>
                <div className="info-receipt-net">
                  <dt>Estimated net proceeds</dt>
                  <dd>
                    83.38 <span>pUSD</span>
                  </dd>
                </div>
                <div className="info-receipt-remainder">
                  <dt>Left unsold</dt>
                  <dd>
                    110 <span>shares</span>
                  </dd>
                </div>
              </dl>
              <p>
                After the modeled venue fee. Excludes network, intermediary, conversion and
                withdrawal costs. pUSD is venue collateral, not a bank withdrawal.
              </p>
            </div>
          </div>
        </section>

        <section className="site-width info-section info-outcome" aria-labelledby="outcome-heading">
          <div>
            <p className="site-eyebrow">04 / After authorization</p>
            <h2 id="outcome-heading" className="info-section-heading">
              Follow the outcome,
              <br />
              not just the click.
            </h2>
          </div>
          <div className="info-section-copy">
            <p>
              An accepted order and a confirmed fill are different events. Activity separates order
              status, matched shares and confirmed settlement.
            </p>
            <p>
              Where a live remainder is eligible, you can request cancellation. If a submission’s
              outcome is uncertain, check the venue before trying again.
            </p>
            <p className="info-small site-muted">
              Current live activity tracks confirmed shares and transaction references. Final net
              proceeds are not yet reconciled.
            </p>
            <Link href="/how-it-works" className="site-text-link">
              Walk through an exit <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </section>

        <section className="site-width info-closing" aria-labelledby="try-heading">
          <div>
            <p className="site-eyebrow">Make the next decision clearer</p>
            <h2 id="try-heading" className="info-section-heading">
              Start with an example.
            </h2>
            <p>Choose the sample position, adjust its floor and see what would remain.</p>
          </div>
          <Link
            href="/app?mode=example"
            prefetch={false}
            className="site-button site-button-primary"
          >
            Try the exit planner <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </section>
      </article>
    </SiteShell>
  );
}
