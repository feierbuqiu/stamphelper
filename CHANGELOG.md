# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and releases follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-07-31

### Added

- Static postage calculation for supported domestic, Hong Kong/Macao/Taiwan, and international counter-service combinations.
- Multi-alias country and territory search with route-mode availability indicators.
- Globally optimal finite-inventory stamp solver with Web Worker execution.
- Custom commemorative denominations, device-local inventory persistence, and theme preferences.
- Responsive light, dark, and system themes with mobile and accessibility refinements.
- Reproducible Cloudflare Pages staging with strict CSP and defensive headers.
- English and Simplified Chinese project documentation, tests, release automation, and GitHub Packages metadata.

### Security

- Exact hash-based script and style CSP without `unsafe-inline` or `unsafe-eval`.
- Exact immutable-cache rules only for assets present in the release; missing asset paths receive a real 404 page instead of a permanently cached SPA fallback.
- Dependency, package-content, secret-pattern, rendered-output, and performance-budget checks.

[Unreleased]: https://github.com/feierbuqiu/stamphelper/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/feierbuqiu/stamphelper/releases/tag/v1.0.0
