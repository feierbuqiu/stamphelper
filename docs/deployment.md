# Cloudflare Pages deployment

## Build locally

```bash
npm ci
npm run check
npm run pages:stage
```

Deploy the contents of `dist/cloudflare-pages/`.

Recommended Cloudflare Pages settings:

| Setting | Value |
| --- | --- |
| Framework preset | None |
| Build command | `npm run pages:stage` |
| Build output directory | `dist/cloudflare-pages` |
| Node.js | 22 or newer |
| Functions | None |

No environment variable, database binding, KV namespace, secret, or runtime API is required.

## Why the package is staged

The Vite output alone is not the complete Pages artifact. Staging additionally:

- renders a static root document;
- creates a dedicated `404.html`;
- checks that the hashed solver Worker exists and is referenced;
- generates CSP hashes from the final inline bytes;
- emits `_headers` with security and cache policy;
- assigns the Worker an explicit JavaScript content type.

Immutable cache rules are generated for exact existing asset names. Do not replace them with `/assets/*`: if a missing asset falls back to HTML, that wildcard can cache the HTML under a JavaScript URL for a year.

## Post-deployment verification

Get the current Worker filename from the deployed JavaScript bundle or the build log, then test its exact URL without a query string:

```bash
curl -I https://stamphelper-cn.feierbuqiu.uk/
curl -I https://stamphelper-cn.feierbuqiu.uk/assets/stamp-solver.worker-REPLACE_ME.js
curl -I https://stamphelper-cn.feierbuqiu.uk/assets/definitely-missing.js
```

Expected results:

- `/` returns `text/html` with CSP, `X-Content-Type-Options: nosniff`, and `X-Frame-Options: DENY`.
- The real Worker returns `200` and `Content-Type: application/javascript`.
- The deliberately missing asset returns `404`, not the application HTML with a one-year immutable cache header.
- The result card reports the background-thread optimizer after a fresh load.

Do not add a random query string when checking the Worker. A different query can bypass a poisoned cache entry and conceal the production problem.

## Rollback

Use Cloudflare Pages deployment history to promote the previous known-good deployment. If an asset URL was ever cached with the wrong MIME type or body, purge that exact URL. A new content hash protects new visitors, while a purge also addresses the CDN entry for the old URL.
