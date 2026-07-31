# Architecture

StampHelper is designed as a static, privacy-preserving web application. It has no application backend, account system, database, telemetry collector, or runtime postal API.

## Runtime boundaries

```text
User input
   │
   ├─> postage-calculator.ts ─> validated postage in integer fen
   │
   └─> stamp profile ─────────> normalized local inventory
                                  │
                                  v
                         Web Worker optimizer
                                  │
                                  v
                         immutable result model
                                  │
                                  v
                              React UI
```

- `lib/postage-calculator.ts` owns legal combinations, units, rate bands, extras, and formula explanations.
- `lib/stamp-solver.ts` owns bounded/unbounded optimization and the globally ordered objective.
- `lib/stamp-solver.worker.ts` isolates expensive work from rendering.
- `lib/use-stamp-calculation.ts` handles request identity, debouncing, stale-response rejection, delayed progress feedback, and fallback behavior.
- `lib/stamp-profile.ts` validates and persists inventory, custom denominations, and theme selection.
- `lib/destination-search.ts` normalizes destination aliases and resolves postal zones or parcel routes.
- `app/page.tsx` orchestrates these modules; it does not implement the underlying postage or optimization algorithms.

## Build pipeline

1. `npm run data:generate` validates the reviewed sources under `data/` and produces deterministic JSON under `app/`.
2. Vinext and Vite build the React application and the module Worker.
3. `scripts/stage-cloudflare-pages.mjs` server-renders the root page and copies browser assets.
4. `scripts/security-policy.mjs` hashes final inline scripts/styles and emits the Cloudflare Pages `_headers` file.
5. The staging script verifies that exactly one hashed Worker exists, is JavaScript, and is referenced by a client bundle.
6. Tests inspect formulas, generated data, output structure, response policy, and compressed asset budgets.

## Optimization objective

For target postage `T`, denomination `vᵢ`, stock limit `cᵢ`, and selected count `xᵢ`, the solver orders feasible solutions by:

1. exact total before any overpayment;
2. smallest overpayment when exact payment is impossible;
3. fewest stamps for equal paid totals;
4. deterministic denomination ordering for stable output.

Money is represented in integer fen. Weight calculations normalize to integer grams before rate lookup.

## Trust boundaries

- Checked-in data is validated during generation and tested against expected dimensions.
- Browser storage is untrusted and normalized before use.
- User text is rendered through React; it is never compiled or inserted as executable HTML.
- The only intentional `dangerouslySetInnerHTML` value is a compile-time theme bootstrap constant whose exact bytes are pinned by CSP.
- Production output has no source maps, secret files, server credentials, or third-party runtime scripts.

## Caching and failure behavior

Only asset filenames present in a build receive immutable cache headers. Missing `/assets/` paths are not covered by a wildcard and a dedicated `404.html` prevents SPA fallback content from masquerading as JavaScript. The Worker has an explicit JavaScript content type and a content-derived filename.

If Worker construction fails, the application retains a functionally correct main-thread compatibility solver. This fallback is observable in the result card and is not used to hide deployment failures.
