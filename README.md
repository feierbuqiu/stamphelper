# StampHelper

[简体中文](README.zh-CN.md)

[![CI](https://github.com/feierbuqiu/stamphelper/actions/workflows/ci.yml/badge.svg)](https://github.com/feierbuqiu/stamphelper/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/feierbuqiu/stamphelper)](https://github.com/feierbuqiu/stamphelper/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

StampHelper is a privacy-first, static postage calculator and finite-inventory stamp optimizer for services accepted at China Post universal-service counters. It calculates the applicable postage, then finds a globally optimal stamp combination: exact postage first, the fewest stamps second; if exact postage is impossible, the smallest overpayment first and the fewest stamps second.

**Live site:** [stamphelper-cn.feierbuqiu.uk](https://stamphelper-cn.feierbuqiu.uk/)

![StampHelper social preview](public/og-postage.png)

## Highlights

- Domestic, Hong Kong/Macao/Taiwan, and international counter-service scenarios covered by the bundled data snapshot.
- Country and territory search by Simplified Chinese, pinyin, initials, English names, ISO codes, calling codes, common aliases, and selected local Latin names.
- Integer-fen calculations throughout; no floating-point money arithmetic.
- Bounded and unlimited stamp inventories, custom commemorative denominations from CNY 0.01 to CNY 200.00, and exact minimum-stamp optimization.
- A Web Worker keeps pathological solver inputs off the main thread; ordinary recalculations retain the previous result and avoid layout flashes.
- Device-local preferences in `localStorage` and IndexedDB. No account, analytics, database, or application backend.
- Light, dark, and system themes, responsive mobile layout, keyboard-accessible controls, and reduced-motion support.
- A hash-based Content Security Policy and defensive Cloudflare Pages headers generated from the final static HTML.

## Quick start

Requirements: Node.js `>=22.13.0` and npm.

```bash
git clone https://github.com/feierbuqiu/stamphelper.git
cd stamphelper
npm ci
npm run dev
```

The development server normally starts at `http://localhost:3000`.

## Validation

```bash
npm run lint
npm audit
npm test
npm run pack:inspect
```

The test pipeline regenerates and validates the static datasets, builds the production application, stages the Cloudflare Pages output, exercises postage formulas and the optimizer, and verifies the Worker asset, strict CSP, security headers, dark native select styling, update-state regression, rendered HTML, and compressed-resource budgets.

## Build and deploy

```bash
npm run pages:stage
```

Deploy `dist/cloudflare-pages/` as the Cloudflare Pages output directory. The staging script produces `index.html`, a dedicated `404.html`, exact immutable-cache rules for existing hashed assets, and an exact JavaScript content type for the Worker. Unknown `/assets/` paths are deliberately not covered by an immutable wildcard, preventing an SPA fallback page from poisoning a missing asset URL.

See [Deployment](docs/deployment.md) for Cloudflare settings and post-deployment checks.

## Project structure

| Path | Purpose |
| --- | --- |
| `app/` | Page composition, styling, and generated static data |
| `components/` | Reusable accessible interface components |
| `lib/` | Postage rules, destination search, persistence, and optimization |
| `data/` | Reviewed source snapshots used to regenerate postage data |
| `scripts/` | Data generation, security policy, release checks, and Pages staging |
| `tests/` | Formula, solver, search, persistence, security, rendering, and budget tests |
| `docs/` | Architecture, methodology, deployment, release, and Chinese technical notes |

The UI orchestrates state; domain rules and algorithms remain framework-independent modules. See [Architecture](docs/architecture.md) and [Data and methodology](docs/data-and-methodology.md).

## Published artifacts

- [GitHub Releases](https://github.com/feierbuqiu/stamphelper/releases) provide a ready-to-deploy Cloudflare Pages ZIP and checksums.
- [`@feierbuqiu/stamphelper`](https://github.com/feierbuqiu/stamphelper/pkgs/npm/stamphelper) is the versioned source distribution on GitHub Packages. GitHub's npm registry requires authentication even for public packages.
- The repository remains the recommended entry point for contributors and source builds.

## Privacy and security

StampHelper sends no calculator inputs or inventory data to an application server. A static frontend still has a supply-chain and DOM security surface, so production output uses React escaping, validated persisted data, no third-party runtime scripts, a strict hash-based CSP without `unsafe-inline` or `unsafe-eval`, and restrictive browser headers.

Do not place secrets in frontend source or build-time variables: anything shipped to a browser is public. Please report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

## Data accuracy and disclaimer

Rates, routes, and service availability are versioned snapshots assembled from public postal references and documented third-party comparisons. Postal systems can be inconsistent and operational availability can change without notice. Always confirm acceptance, routing, and the final charge with China Post at the time of posting.

This is an independent project. It is not affiliated with, endorsed by, or operated by China Post. Names and trademarks belong to their respective owners.

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md), the [Code of Conduct](CODE_OF_CONDUCT.md), and [SUPPORT.md](SUPPORT.md) before opening an issue or pull request.

## License

Source code is released under the [MIT License](LICENSE). Structured datasets have separate terms described in [DATA_LICENSES.md](DATA_LICENSES.md), and bundled components are acknowledged in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Third-party names and trademarks remain subject to their respective rights.
