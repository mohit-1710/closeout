# Closeout deployment

- App: **https://closeout-ashen.vercel.app**
- Repository: **https://github.com/mohit-1710/closeout**
- Hosting: Vercel project `closeout`, connected to the repository's `main` branch.
- Runtime: Node 24; `npm ci` and the Next.js production build.

The first published production deployment, `dpl_8CHHimJsxTDHGbHBpZsDjvo4zT4D`, reached READY for commit `b65de78d81c59c083e9ecbd3113478b5ae8426e5` on September 12, 2026. [Public smoke evidence](qa/deployment-public-reads.json) records successful page, market and order-book reads at 15:55 UTC. Main-branch pushes trigger new deployments; the stable app URL points to the latest production deployment.

## Configuration

`NEXT_PUBLIC_PRIVY_APP_ID` is the only configured application environment variable. It is a public browser identifier, set for production, preview and development. The app does not require a Privy secret. Environment changes affecting this public variable require a new build.

Allow **https://closeout-ashen.vercel.app** in Privy's Closeout app before using wallet login. At the September 12, 15:58 UTC check, only the two localhost origins were allowed; production origin setup remains pending. See [Privy setup](privy-setup.md) for the current verification boundary.

The venue's public APIs must be reachable from the server. Wallet authentication, geography checks, signing and orders run in the user's browser. Server location does not establish a user's geographic eligibility.

## Release checks

The [Checks workflow](../.github/workflows/checks.yml) installs the lockfile, runs tests and builds on every main-branch push and pull request. GitHub CI and Vercel builds run separately; this setup does not make Vercel deployment wait for CI. Inspect both results before sharing a changed release.

Local environment files, Vercel link state and build outputs are Git-ignored. `.vercelignore` also excludes environment files, Git data, generated reports and documentation from CLI uploads; `.env.example` is the empty setup template. A CLI upload dry run confirmed those exclusions before publication.

Public reads do not establish wallet login, authenticated execution or settled proceeds. No wallet, order, cancellation, approval, deposit or withdrawal was exercised by the deployment check.
