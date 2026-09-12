"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { CloseoutLogo } from "./brand";

export function SiteNavigation() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => setOpen(false), [pathname]);
  return (
    <header
      className="site-header"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <div className="site-width site-header-inner">
        <Link href="/" aria-label="Closeout home" className="site-brand">
          <CloseoutLogo />
        </Link>
        <nav aria-label="Main navigation" className="site-desktop-nav">
          <Link href="/product" aria-current={pathname === "/product" ? "page" : undefined}>
            Product
          </Link>
          <Link
            href="/how-it-works"
            aria-current={pathname === "/how-it-works" ? "page" : undefined}
          >
            How it works
          </Link>
          <Link href="/how-it-works#questions">Questions</Link>
        </nav>
        <div className="site-header-actions">
          <Link
            href="/app"
            className="site-button site-button-primary site-header-cta"
            prefetch={false}
          >
            Open app <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
          <button
            ref={trigger}
            className="site-menu-toggle"
            aria-label={open ? "Close navigation" : "Open navigation"}
            aria-expanded={open}
            aria-controls="mobile-navigation"
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
          </button>
        </div>
      </div>
      {open && (
        <nav id="mobile-navigation" className="site-mobile-nav" aria-label="Mobile navigation">
          <Link href="/product" onClick={() => setOpen(false)}>
            Product <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
          <Link href="/how-it-works" onClick={() => setOpen(false)}>
            How it works <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
          <Link href="/how-it-works#questions" onClick={() => setOpen(false)}>
            Questions <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
          <Link href="/app?mode=example" prefetch={false} onClick={() => setOpen(false)}>
            Try an example <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        </nav>
      )}
    </header>
  );
}
