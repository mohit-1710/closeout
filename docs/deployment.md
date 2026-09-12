# Deployment

The canonical site is [closeout-ashen.vercel.app](https://closeout-ashen.vercel.app). The trading workspace lives at [/app](https://closeout-ashen.vercel.app/app); [/app?mode=example](https://closeout-ashen.vercel.app/app?mode=example) opens explicitly fictional data.

## Hosting and configuration

Closeout is a Next.js application deployed on Vercel. Use Node.js 24 or later, `npm ci` and `npm run build`. The public profile, position, market and book API routes require a server runtime; a static export is insufficient. See [architecture](architecture.md) for route boundaries.

`NEXT_PUBLIC_PRIVY_APP_ID` is the optional public browser identifier shown in [the environment template](../.env.example). With it, the workspace offers the configured Privy external-wallet chooser. Without it, the workspace uses an injected Ethereum provider. This integration needs no Privy app secret, builder secret or server wallet key. Changes to the public identifier require a rebuild.

Allow the exact production origin in Privy:

```text
https://closeout-ashen.vercel.app
```

Preview deployments need their own approved origins to support wallet login. Do not allow every Vercel tenant with a broad wildcard. See [Privy setup](privy-setup.md).

## Build and release

The [GitHub workflow](../.github/workflows/checks.yml) runs locked installation, unit tests, formatting and a production build on main-branch pushes and pull requests. Vercel deployment and GitHub checks are separate systems; a successful deployment alone does not establish that every check passed.

[Deployment exclusions](../.vercelignore) omit environment files, local dependencies, docs and generated artifacts. The empty environment template is retained. Application assets belong in `public/` or an application asset route, rather than in the excluded documentation directory.

After release, check the public pages and `/app`, public API error states, explicit example entry, and the configured wallet chooser. Browser scripts accept a `BASE_URL` origin and append the workspace path themselves. Their reports go to ignored `.artifacts/qa/`; reproduction commands and current results are in [verification](verification.md).

## Validation boundary

Public reads and opening, dismissing and reopening the Privy chooser have been checked. Actual wallet authentication, signing, live order submission, cancellation, approvals and funded execution remain unvalidated. Live final net proceeds are not reconciled. Preserve these limits when describing a deployment as working; see [execution integration](execution-integration.md).
