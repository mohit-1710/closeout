# Closeout brand

The visual system follows a warm, editorial direction inspired by [AgentTrust](https://www.agenttrust.tech/). Shared tokens, typography and the Closeout mark connect the product website to the position-first workspace.

Closeout helps prediction-market traders understand and control an exit from an existing position. The public website explains the decision. The workspace guides the user through choosing a position, planning its exit and reviewing the order.

## Direction

Warm editorial finance: paper-white surfaces, deep ink, restrained violet, serif display headings and precise sans-serif controls. Public pages have generous space and varied section structure. The workspace reveals detail as it becomes useful: entry, portfolio, exit plan, review and activity. Each stage has one clear next action. The product theme is light.

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

Supporting text and warning colors are darkened for small financial labels. Color is never the sole distinction between order states. Color variables are defined in [globals.css](src/app/globals.css); the workspace uses those tokens through Tailwind utilities and its scoped [journey styles](src/components/exit-workspace.css).

## Type and identity

- Fraunces: editorial display headings, 400–500 weight; selective italics.
- Geist: UI/body and wordmark, 400/500/600.
- Geist Mono: tabular financial numerals, small structural labels and identifiers, never long paragraphs.
- Fonts are served by Next's self-hosted font pipeline.
- The custom mark combines an open C with a rightward exit arrow. [brand.tsx](src/components/brand.tsx) is the inline UI mark. [icon.svg](src/app/icon.svg) is the compact app mark, with generated ICO/Apple/PNG/social variants.

## Voice and interaction

Lead with the trader's decision and the actual product. Use plain, useful language: price floor, fees, fillable shares, unsold shares. Keep technical details on engineering pages unless they change a user's decision. Do not fabricate adoption, returns, counterparties, endorsements, completed trades or product-market fit.

Primary action opens `/app`; secondary action opens `/app?mode=example`. Live entry offers connection to find a wallet's public positions or manual profile/account lookup. Example entry opens a fictional portfolio for explicit selection. Neither starts with an arbitrary market or trade amount.

An imported portfolio is described as read-only. A connected wallet, a remembered profile and an authorized trading account are distinct states. The direct wallet chooser belongs to the connection action; the review dialog belongs to the trading decision. Recent-profile convenience must always mean a fresh lookup, never a silently restored session.

Show loading, empty results, failed lookups and blocked execution with a specific recovery action. Keep the original manual entry available after an error. In the planner, show gross proceeds, estimated venue fees, estimated net and unsold shares together. Explain that the floor is a gross price per share and that a snapshot cannot guarantee a fill. After submission, show order evidence rather than treating acceptance as completion.

Native links/buttons, visible focus, touch targets and reduced-motion support are required. Stage changes move focus to the new heading. Navigation is locked during position selection, review loading and submission; financial context must not change underneath review.

Motion: short state feedback and one restrained desktop entrance. No scrolling lock, fake carousel, decorative auto-playing video, or motion on every quote refresh. Illustrative financial data is labeled, and the homepage preview uses the real decimal quote engine against a fixed fictional book.
