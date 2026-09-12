"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, SlidersHorizontal } from "lucide-react";
import { exampleBook } from "@/lib/example-data";
import { buildQuote } from "@/lib/quote";
import { useClientReady } from "@/hooks/use-client-ready";

const snapshot = exampleBook("example-yes", 0);
const prices = ["0.58", "0.60", "0.62"];
export function ExitPreview() {
  const ready = useClientReady();
  const [floor, setFloor] = useState("0.60");
  const quote = buildQuote(snapshot, "250", floor, "FAK", 0);
  return (
    <section className="exit-preview" aria-label="Interactive example of an exit plan">
      <div className="preview-topline">
        <span>
          <span className="preview-dot" /> Interactive example
        </span>
        <SlidersHorizontal size={16} aria-hidden="true" />
      </div>
      <div className="preview-market">
        <span className="preview-market-icon" aria-hidden="true">
          <ArrowUpRight size={24} />
        </span>
        <div>
          <span className="preview-overline">A FICTIONAL PREDICTION MARKET</span>
          <h2>Atlas mission launches this month</h2>
        </div>
        <span className="preview-outcome">Yes</span>
      </div>
      <div className="preview-book">
        <div className="preview-book-heading">
          <span>Buyers at your price</span>
          <span>Shares</span>
        </div>
        {snapshot.bids.slice(0, 5).map((bid) => (
          <div
            key={bid.price}
            className="preview-depth-row"
            data-eligible={Number(bid.price) >= Number(floor)}
          >
            <span className="preview-depth-price">{bid.price}</span>
            <div className="preview-depth-track">
              <span style={{ width: `${(Number(bid.size) / 110) * 100}%` }} />
            </div>
            <span className="preview-depth-size">{bid.size}</span>
          </div>
        ))}
      </div>
      <div className="preview-floor">
        <div>
          <span className="preview-overline">YOUR PRICE FLOOR</span>
          <span>pUSD per share</span>
        </div>
        <div className="preview-price-options" aria-label="Example minimum price per share">
          {prices.map((price) => (
            <button
              key={price}
              disabled={!ready}
              aria-pressed={floor === price}
              onClick={() => setFloor(price)}
            >
              {price}
            </button>
          ))}
        </div>
      </div>
      <div className="preview-result" aria-live="polite" aria-atomic="true">
        <div>
          <span className="preview-overline">OF YOUR 250 SHARES</span>
          <p>
            <strong aria-label="Fillable shares">{quote.filledShares}</strong>
            <span>could fill</span>
            <ArrowRight size={20} aria-hidden="true" />
            <strong aria-label="Unsold shares">{quote.remainingShares}</strong>
            <span>stay yours</span>
          </p>
        </div>
        <span className="preview-check" aria-hidden="true">
          <Check size={18} />
        </span>
      </div>
      <div className="preview-footer">
        <span>Fictional data. No funds move.</span>
        <Link href="/app?mode=example" prefetch={false}>
          See the full plan <ArrowUpRight size={14} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
