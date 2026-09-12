"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, FlaskConical, X } from "lucide-react";
import { CloseoutLogo } from "@/components/brand";
import type { Position, WorkspaceController } from "@/lib/types";
import { PositionEntry, PortfolioView } from "./journey/onboarding";
import { ExitPlanner } from "./journey/exit-planner";
import { ReviewDialog } from "./journey/review-dialog";
import { ActivityView } from "./journey/activity-view";
import { shortAddress, useClientReady } from "./journey/primitives";
import "./exit-workspace.css";

export interface ExitWorkspaceProps {
  workspace: WorkspaceController;
}
type View = "entry" | "portfolio" | "plan" | "activity";

/** Navigation and disclosure state only. The controller owns accounts, quotes and execution. */
export function ExitWorkspace({ workspace: w }: ExitWorkspaceProps) {
  const [view, setView] = useState<View>(w.mode === "example" ? "portfolio" : "entry");
  const [requestError, setRequestError] = useState<string | null>(null);
  const [selecting, setSelecting] = useState<string | null>(null);
  const pendingConnectedLookup = useRef(false);
  const confirmationOrders = useRef<Set<string> | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const previousView = useRef(view);
  const id = useId();
  const shownView =
    view === "plan" && !w.selectedPosition
      ? w.positionState === "ready"
        ? "portfolio"
        : "entry"
      : view;
  const portfolioReady = w.positionState === "ready";
  const orders = w.orders.filter((o) => o.mode === w.mode);
  const clientReady = useClientReady();
  const navigationLocked =
    !clientReady ||
    w.reviewLoading ||
    w.submitting ||
    !!selecting ||
    w.positionSelectionState === "loading";
  const currentStep = w.reviewOpen ? 3 : shownView === "plan" ? 2 : 1;

  useEffect(() => {
    setView(w.mode === "example" ? "portfolio" : "entry");
    setRequestError(null);
    setSelecting(null);
    pendingConnectedLookup.current = false;
    confirmationOrders.current = null;
  }, [w.mode]);
  useEffect(() => {
    if (previousView.current === shownView) return;
    previousView.current = shownView;
    const heading = mainRef.current?.querySelector("h1");
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [shownView]);
  useEffect(() => {
    if (!pendingConnectedLookup.current || w.walletStatus !== "connected" || w.mode !== "live")
      return;
    pendingConnectedLookup.current = false;
    // A deliberate entry connection can import a portfolio. Connecting to review
    // a watched account must never replace that account with the signer's portfolio.
    if (w.accountAddress && w.positionState === "ready") return;
    void w
      .onLoadConnectedPositions()
      .then((ok) => {
        if (ok) setView("portfolio");
      })
      .catch(() =>
        setRequestError(
          "The connected account lookup did not finish. Try again or use a public profile.",
        ),
      );
  }, [
    w.walletStatus,
    w.signerAddress,
    w.mode,
    w.accountAddress,
    w.positionState,
    w.onLoadConnectedPositions,
  ]);
  useEffect(() => {
    if (!confirmationOrders.current || w.reviewOpen || w.submitting) return;
    const hasNewOrder = w.orders.some((o) => !confirmationOrders.current!.has(o.id));
    confirmationOrders.current = null;
    if (hasNewOrder) setView("activity");
  }, [w.orders, w.reviewOpen, w.submitting]);

  function changeMode(mode: "live" | "example") {
    if (navigationLocked) return;
    pendingConnectedLookup.current = false;
    setRequestError(null);
    if (mode === w.mode)
      setView(mode === "example" ? "portfolio" : portfolioReady ? "portfolio" : "entry");
    else w.onModeChange(mode);
  }
  async function loadPublic() {
    pendingConnectedLookup.current = false;
    setRequestError(null);
    try {
      if (await w.onLoadPositions()) setView("portfolio");
    } catch {
      setRequestError("The public lookup did not finish. Your entry is saved; try again.");
    }
  }
  async function resumePublic() {
    pendingConnectedLookup.current = false;
    setRequestError(null);
    try {
      if (await w.onResumeRecentProfile()) setView("portfolio");
    } catch {
      setRequestError(
        "The saved profile could not be refreshed. Try again or enter its public address.",
      );
    }
  }
  async function connectForPositions() {
    setRequestError(null);
    if (w.walletStatus === "connected") {
      try {
        if (await w.onLoadConnectedPositions()) setView("portfolio");
      } catch {
        setRequestError(
          "The connected account lookup did not finish. Try again or use a public profile.",
        );
      }
    } else {
      pendingConnectedLookup.current = true;
      w.onConnect();
    }
  }
  function connectForReview() {
    pendingConnectedLookup.current = false;
    w.onConnect();
  }
  function editAccount() {
    if (navigationLocked) return;
    pendingConnectedLookup.current = false;
    setRequestError(null);
    w.onResetPortfolio();
    setView("entry");
  }
  async function choosePosition(position: Position) {
    setRequestError(null);
    if (w.selectedPosition?.tokenId === position.tokenId && w.selectedMarket) {
      setView("plan");
      return;
    }
    setSelecting(position.tokenId);
    try {
      if (await w.onSelectPosition(position)) setView("plan");
    } catch {
      setRequestError("This position could not be opened. Try again or choose another position.");
    } finally {
      setSelecting(null);
    }
  }
  function positions() {
    if (navigationLocked) return;
    setView(portfolioReady ? "portfolio" : "entry");
  }
  function confirm() {
    confirmationOrders.current = new Set(w.orders.map((o) => o.id));
    w.onConfirm();
  }
  function backFromActivity() {
    if (navigationLocked) return;
    setView(w.selectedPosition ? "plan" : portfolioReady ? "portfolio" : "entry");
  }

  return (
    <div className="j-workspace" data-view={shownView} data-mode={w.mode}>
      <a className="j-skip-link" href={`#${id}-main`}>
        Skip to workspace
      </a>
      <header className="j-header">
        <Link href="/" className="j-brand" aria-label="Closeout home">
          <CloseoutLogo />
        </Link>
        <nav className="j-header-nav" aria-label="Workspace">
          <button
            disabled={navigationLocked}
            onClick={positions}
            aria-current={shownView !== "activity" ? "page" : undefined}
          >
            Positions
          </button>
          <button
            disabled={navigationLocked}
            onClick={() => setView("activity")}
            aria-current={shownView === "activity" ? "page" : undefined}
          >
            Activity{orders.length > 0 && <span>{orders.length}</span>}
          </button>
        </nav>
        <div className="j-header-account">
          {w.mode === "example" ? (
            <span className="j-badge">
              <FlaskConical size={15} aria-hidden />
              Sample mode
            </span>
          ) : w.walletStatus === "connected" && w.signerAddress ? (
            <>
              <span className="j-wallet-address" title={w.signerAddress}>
                <Check size={14} aria-hidden />
                {shortAddress(w.signerAddress)}
              </span>
              <button
                className="j-text-link"
                disabled={navigationLocked}
                onClick={() => {
                  pendingConnectedLookup.current = false;
                  w.onDisconnect();
                }}
              >
                Disconnect
              </button>
            </>
          ) : (
            <Link className="j-text-link" href="/how-it-works">
              How it works
            </Link>
          )}
        </div>
      </header>
      <main ref={mainRef} id={`${id}-main`} className="j-main">
        {shownView !== "activity" && (
          <nav aria-label="Exit steps" className="j-stepper">
            <ol>
              {[
                { number: 1, label: "Choose position", action: positions, enabled: true },
                {
                  number: 2,
                  label: "Plan exit",
                  action: () => setView("plan"),
                  enabled: !!w.selectedPosition,
                },
                { number: 3, label: "Review", action: undefined, enabled: false },
              ].map((step) => (
                <li
                  key={step.number}
                  data-current={currentStep === step.number}
                  data-complete={currentStep > step.number}
                >
                  {step.action ? (
                    <button
                      onClick={step.action}
                      disabled={!step.enabled || navigationLocked}
                      aria-current={currentStep === step.number ? "step" : undefined}
                    >
                      <span>
                        {currentStep > step.number ? <Check size={14} aria-hidden /> : step.number}
                      </span>
                      {step.label}
                    </button>
                  ) : (
                    <span aria-current={currentStep === step.number ? "step" : undefined}>
                      <span>{step.number}</span>
                      {step.label}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}
        {w.mode === "example" && (
          <div className="j-fiction-banner">
            <span>
              <FlaskConical size={18} aria-hidden />
              <strong>Fictional.</strong> No funds move.
            </span>
            <button
              className="j-text-link"
              disabled={navigationLocked}
              onClick={() => changeMode("live")}
            >
              Use my positions
              <ArrowLeft size={15} aria-hidden />
            </button>
          </div>
        )}
        {w.toast && (
          <div className="j-toast" role="status">
            <span>{w.toast}</span>
            <button
              className="j-icon-button"
              aria-label="Dismiss notification"
              onClick={w.onDismissToast}
            >
              <X size={17} aria-hidden />
            </button>
          </div>
        )}
        {shownView === "entry" && (
          <PositionEntry
            workspace={w}
            onConnect={() => void connectForPositions()}
            onLoad={() => void loadPublic()}
            onResume={() => void resumePublic()}
            onExample={() => changeMode("example")}
            error={requestError}
          />
        )}
        {shownView === "portfolio" && (
          <PortfolioView
            workspace={w}
            onChoose={(p) => void choosePosition(p)}
            onEdit={editAccount}
            onRetry={() => void loadPublic()}
            onExample={() => changeMode("example")}
            onContinue={() => setView("plan")}
            selecting={selecting}
            error={requestError}
          />
        )}
        {shownView === "plan" && (
          <ExitPlanner
            key={`${w.mode}-${w.selectedPosition?.tokenId}`}
            workspace={w}
            onBack={() => {
              if (!navigationLocked) setView("portfolio");
            }}
            onConnect={connectForReview}
            onActivity={() => setView("activity")}
          />
        )}
        {shownView === "activity" && (
          <ActivityView
            workspace={w}
            onBack={backFromActivity}
            onPositions={positions}
            onLive={() => changeMode("live")}
          />
        )}
        <footer className="j-footer">
          <span>Closeout · Plan before you sign.</span>
          <Link href="/how-it-works#questions">Questions about exiting?</Link>
        </footer>
      </main>
      <ReviewDialog workspace={w} onConfirm={confirm} />
    </div>
  );
}
export default ExitWorkspace;
