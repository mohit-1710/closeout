# Closeout brand

Status: selected by Mohit, September 12, 2026. Reference: [AgentTrust](https://www.agenttrust.tech/), another product owned by Mohit. This replaces the earlier dark/lime direction at his explicit request. The previous theme is preserved in Git and local `.bak` files.

Closeout helps prediction-market traders understand and control an exit from an existing position. The public website explains that decision; the dedicated planner is an efficient financial workspace.

## Direction

Warm editorial finance: paper-white surfaces, deep ink, restrained violet, serif display headings and precise sans-serif controls. Public pages have generous space and varied section structure. The planner uses compact, clearly grouped panels. Default and current product theme is light. Dark mode is not exposed as a half-finished option.

## Colors

| Role | Color | Use |
| --- | --- | --- |
| Background | `#fbfaf9` | AgentTrust's exact warm white |
| Surface | `#ffffff` | Main panels and white control surfaces |
| Foreground | `#0a0a0a` | AgentTrust's exact ink; deliberate near-black |
| Primary | `#6f4cff` | AgentTrust's exact violet; action, selection, eligible bid depth |
| Primary text | `#ffffff` | Labels on violet |
| Primary hover | `#5c39e8` | Interactive feedback |
| Raised | `#f3f0f7` | Quiet secondary surface |
| Accent soft | `#f0ebff` | Background only; use ink for small foreground text |
| Muted | `#68646f` | Accessible supporting copy |
| Border | `#dfdce4` | Structural dividers |
| Input border | `#96909e` | Meaningful control boundaries |
| Success | `#1f7a3d` | Confirmed success or supported positive state |
| Warning | `#895e0c` | Readable warning text |
| Danger | `#b63726` | Readable errors |

AgentTrust's original translucent muted text and amber are darkened here for small financial labels. Color is never the sole distinction between order states. Color variables are defined in `src/app/globals.css`; the workspace maps those tokens through its `--co-*` aliases.

## Type and identity

- Fraunces: editorial display headings, 400–500 weight; selective italics.
- Geist: UI/body and wordmark, 400/500/600; tabular financial numerals.
- Geist Mono: small structural labels and identifiers, never long paragraphs.
- Fonts are served by Next's self-hosted font pipeline.
- The custom mark combines an open C with a rightward exit arrow. `src/components/brand.tsx` is the inline UI mark. `src/app/icon.svg` is the compact app mark, with generated ICO/Apple/PNG/social variants.

## Voice and interaction

Lead with the trader's decision and the actual product. Use plain, useful language: price floor, fees, fillable shares, unsold shares. Keep technical details on engineering pages unless they change a user's decision. Do not fabricate adoption, returns, counterparties, endorsements, completed trades or product-market fit.

Primary action opens `/app`; secondary action opens `/app?mode=example`. The latter starts explicitly in fictional mode. Browsing needs no wallet; authorization belongs at the trading decision. Native links/buttons, visible focus, touch targets and reduced-motion support are required.

Motion: short state feedback and one restrained desktop entrance. No scrolling lock, fake carousel, decorative auto-playing video, or motion on every quote refresh. Illustrative financial data is labeled, and the homepage preview uses the real decimal quote engine against a fixed fictional book.
