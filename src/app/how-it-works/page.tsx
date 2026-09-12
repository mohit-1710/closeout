import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, ChevronDown, Eye, Layers3, ShieldCheck, Wallet } from "lucide-react";
import { SiteShell } from "@/components/site-shell";
import "@/components/info-pages.css";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "Find your Polymarket position, choose a price floor, review the exit and follow its status. Understand partial fills, fees and wallet authorization.",
};

const faqs = [
  {
    id: "wallet",
    question: "Do I need a wallet to try it?",
    answer:
      "No. Paste a public Polymarket profile link or account address to load its positions without connecting. Or choose a sample position. Connecting an existing wallet can find its linked public profile automatically; a real sell separately requires the account owner’s authorization.",
  },
  {
    id: "floor",
    question: "What does the minimum price protect?",
    answer:
      "It sets the lowest gross price per share for your sell. A floor of 0.60 pUSD per share means bids below 0.60 do not count toward the plan. It does not guarantee an after-fee total, or that enough buyers will remain available.",
  },
  {
    id: "partial-fills",
    question: "What happens to shares that do not sell?",
    answer:
      "With Sell available (FAK), the unmatched order remainder is canceled and unsold shares remain in your position. All or nothing (FOK) requires the entire requested quantity to fill within the order’s conditions. The planner blocks an FOK plan when its snapshot shows too little eligible depth.",
  },
  {
    id: "fees",
    question: "What fees does the estimate include?",
    answer:
      "The estimate deducts the modeled venue fee. The Closeout fee is currently zero. Network, intermediary, conversion and withdrawal costs are excluded. Fees can differ with the actual matches; unknown venue fees block submission. Amounts are shown in pUSD, the venue collateral, rather than a promised bank-dollar receipt.",
  },
  {
    id: "example",
    question: "Is Example mode a real trade?",
    answer:
      "No. Its markets, balances, fills and activity are fictional. No funds move and no wallet signature is requested. You choose Example mode explicitly; a failed live request never silently switches to fictional data.",
  },
  {
    id: "live-readiness",
    question: "Is Closeout ready for every live account?",
    answer:
      "Public reads, the example flow and the wallet chooser have been tested. End-to-end owner authentication and a real trade have not yet been verified. Live submission requires a supported existing account, the owner wallet, sufficient approved holdings and venue eligibility. Closeout does not create or fund an account for you, and final live net proceeds are not yet reconciled.",
  },
];

export default function HowItWorksPage() {
  return (
    <SiteShell>
      <article className="info-page">
        <header className="site-width info-hero info-how-hero">
          <p className="site-eyebrow">How Closeout works</p>
          <h1 className="site-display info-heading">
            From your position
            <br />
            to a <em>clearer plan.</em>
          </h1>
          <p className="info-lead">
            Bring your portfolio. Pick a position. Adjust its exit plan before deciding whether to
            sell.
          </p>
          <div className="info-actions">
            <Link href="/app" prefetch={false} className="site-button site-button-primary">
              Find my positions <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <Link href="/app?mode=example" prefetch={false} className="site-text-link">
              Try an example <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </header>

        <div className="site-width info-journey">
          <section className="info-step" aria-labelledby="find-heading">
            <span className="info-step-number" aria-hidden="true">
              01
            </span>
            <div className="info-step-copy">
              <p className="site-eyebrow">Bring what you hold</p>
              <h2 id="find-heading" className="info-section-heading">
                Find your positions.
              </h2>
              <p>
                Connect your existing wallet to locate its public Polymarket profile, or paste a
                profile link, username or account address. Choose the position you want to plan for.
              </p>
              <p className="info-small site-muted">
                Email or Google user? Open your Polymarket profile and copy its public link into
                Closeout.
              </p>
            </div>
            <div className="info-step-aside">
              <Eye size={24} strokeWidth={1.5} aria-hidden="true" />
              <strong>Looking is read-only.</strong>
              <p>
                Profile lookup reads public positions. It never signs in to the venue or grants
                authority to sell.
              </p>
            </div>
          </section>

          <section className="info-step" aria-labelledby="terms-heading">
            <span className="info-step-number" aria-hidden="true">
              02
            </span>
            <div className="info-step-copy">
              <p className="site-eyebrow">Choose your conditions</p>
              <h2 id="terms-heading" className="info-section-heading">
                Set your exit.
              </h2>
              <p>
                The plan starts with your selected position’s size and the current best bid. Change
                the share quantity or minimum price. Choose a partial fill or require the full
                amount.
              </p>
              <p>
                Read the estimated proceeds, fees and shares left unsold together. Raising the floor
                may leave less eligible depth.
              </p>
              <Link href="/product#fill-heading" className="site-text-link">
                Compare the fill choices <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <div className="info-step-aside info-example-aside">
              <span className="info-example-label">Illustrative inputs</span>
              <dl>
                <div>
                  <dt>Shares to sell</dt>
                  <dd>250</dd>
                </div>
                <div>
                  <dt>Minimum / share</dt>
                  <dd>
                    0.60 <small>pUSD</small>
                  </dd>
                </div>
                <div>
                  <dt>Fill choice</dt>
                  <dd>Sell available</dd>
                </div>
              </dl>
              <p>Change these in Example mode without moving funds.</p>
            </div>
          </section>

          <section id="before-you-trade" className="info-step" aria-labelledby="review-heading">
            <span className="info-step-number" aria-hidden="true">
              03
            </span>
            <div className="info-step-copy">
              <p className="site-eyebrow">Keep the decision yours</p>
              <h2 id="review-heading" className="info-section-heading">
                Review. Then authorize.
              </h2>
              <p>
                The planner shows the estimate before any authorization. For a live review, the
                owner wallet may request a sign-in signature to verify the account and available
                holdings.
              </p>
              <p>
                Review refreshes the book and shows the final inputs and estimate. A separate
                confirmation signs and submits the sell only after account and venue requirements
                pass.
              </p>
            </div>
            <div className="info-step-aside">
              <Wallet size={24} strokeWidth={1.5} aria-hidden="true" />
              <strong>Your wallet authorizes.</strong>
              <p>
                Browsing is separate from signing. Example mode simulates this step with no
                signature or real order.
              </p>
            </div>
          </section>

          <section className="info-step" aria-labelledby="follow-heading">
            <span className="info-step-number" aria-hidden="true">
              04
            </span>
            <div className="info-step-copy">
              <p className="site-eyebrow">See what happened</p>
              <h2 id="follow-heading" className="info-section-heading">
                Follow the order.
              </h2>
              <p>
                Activity separates acceptance, matched shares and confirmed settlement. A match
                alone does not establish final proceeds.
              </p>
              <p>
                Request cancellation where a live remainder is eligible. If the outcome is
                uncertain, inspect it at the venue before attempting another sell.
              </p>
            </div>
            <div className="info-step-aside info-status-aside">
              <span className="info-example-label">Different stages</span>
              <ol>
                <li>
                  <Layers3 size={16} aria-hidden="true" />
                  <span>Order accepted</span>
                </li>
                <li>
                  <Check size={16} aria-hidden="true" />
                  <span>Shares matched</span>
                </li>
                <li>
                  <ShieldCheck size={16} aria-hidden="true" />
                  <span>Settlement confirmed</span>
                </li>
              </ol>
              <p>A status guide, not a record of a completed trade.</p>
            </div>
          </section>
        </div>

        <section id="questions" className="info-section info-tinted" aria-labelledby="faq-heading">
          <div className="site-width info-faq-layout">
            <div className="info-faq-intro">
              <p className="site-eyebrow">A few useful answers</p>
              <h2 id="faq-heading" className="info-section-heading">
                Before your
                <br />
                first exit.
              </h2>
              <p>Understand the controls and what the estimate includes.</p>
              <Link href="/product" className="site-text-link">
                Explore the product <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <div className="info-faq-list">
              {faqs.map((faq) => (
                <details id={faq.id} key={faq.id} className="info-faq">
                  <summary>
                    {faq.question}
                    <ChevronDown size={18} aria-hidden="true" />
                  </summary>
                  <div>
                    <p>{faq.answer}</p>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="site-width info-closing" aria-labelledby="start-heading">
          <div>
            <p className="site-eyebrow">Start with a look</p>
            <h2 id="start-heading" className="info-section-heading">
              Your next exit starts here.
            </h2>
            <p>Load a public portfolio, or walk through a clearly labeled sample position.</p>
          </div>
          <div className="info-closing-actions">
            <Link href="/app" prefetch={false} className="site-button site-button-primary">
              Find my positions <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <Link href="/app?mode=example" prefetch={false} className="site-text-link">
              Try an example <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </article>
    </SiteShell>
  );
}
