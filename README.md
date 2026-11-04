# Energy Readiness: Operator Decision Review

An interactive product concept by Raymond Sy. One readiness lead decides what to do about a battery health
concern on a ground robot before it is deployed, and what changes when the battery data is out of date.

> **Independent product concept inspired by public information. Simulated data. Not affiliated with Safire
> Technology Group.** All telemetry, the asset, the rules, and the decisions are simulated. Nothing is predicted,
> nothing is sent anywhere, and no equipment or external system is changed. The health flag is mock data, not
> a Safire diagnostic.

**Live demo (planned, not yet verified):** https://ayray.github.io/energy-readiness/
This URL will work only after the first GitHub Pages deployment succeeds.

## What it shows

The page follows one path: observe the battery telemetry, understand the concern, decide.

- **Fresh data (3 minutes old).** A mock health flag changes from Normal to Watch while charge is a healthy
  81%. The page recommends a review before deployment. The lead can open the supporting evidence (what the data
  establishes, what it does not, and its limits), then:
  - **Request Inspection:** escalates the concern for review. Readiness stays unresolved.
  - **Dismiss Concern:** closes the warning with a required reason (two presets, or "Other" with at least five
    characters). A dismissal **does not authorize deployment**.
- **Stale data (42 minutes old).** The readiness assessment is withheld and the readings are shown as
  historical. Dismissing is blocked; requesting an inspection still works.
- **Decision record.** Each decision records the action, the concern (health flag and data age at the time),
  the simulated time, the reason for a dismissal, and the status.

Two checks drive the page, and both are **proposed concept policies** that would need customer validation:

- **Review check:** a health flag of Watch or worse recommends a review before deployment.
- **Freshness check:** battery data more than 15 minutes old withholds the assessment and blocks dismissal.

Neither is a Safire requirement or standard.

### Presenter controls

The dashed strip at the top switches between the fresh and stale scenarios and resets the demo. It is a
presentation aid and is not part of the concept. "Back to portfolio" in the header returns to
https://ayray.github.io/.

## Built with

React 19, TypeScript, and Vite. Static only: no backend, no analytics, and no network requests after the page
loads. Fonts (Barlow, JetBrains Mono) are bundled, not loaded from a CDN.

## Run locally

Requires Node.js 24.

```bash
npm ci               # install exact dependencies
npm run dev          # development server at http://localhost:5173/energy-readiness/
npx tsc --noEmit     # type check
npm test             # unit tests for the rules and state (Vitest, 14 tests)
npm run build        # type check, then production build to dist/ with base path /energy-readiness/
npm run preview      # serve the production build at http://localhost:4173/energy-readiness/
```

### Browser acceptance tests

```bash
npm run test:e2e     # Playwright, using installed Google Chrome
```

26 browser tests run against the production build served at its `/energy-readiness/` base path. They cover:

- the acceptance criteria for both scenarios;
- automated WCAG 2.1 AA checks (axe) in every state, and keyboard operation;
- copy rules and the absence of off-origin requests;
- layout at 1440, 1280, 1024, and 375 px, and the header from 1100 down to 641 px.

These tests run locally before each release; CI runs the type check, unit tests, and build.

Screenshots of the walkthrough (desktop and 375 px mobile) are in `docs/screenshots/`. To recapture them:

```bash
SCREENSHOTS=1 npx playwright test screenshots
```

## Deployment

`.github/workflows/deploy.yml` deploys to GitHub Pages on every push to `main`: install, type check, unit tests,
production build, then the Pages deploy actions. It deploys only this repository.

## License

No license is granted. All rights reserved.
