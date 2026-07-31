import { createHash } from "node:crypto";

function inlineElementSources(html, tagName) {
  const pattern = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "gi");
  return [...html.matchAll(pattern)].map((match) => match[1]).filter(Boolean);
}

function sourceHash(source) {
  return `'sha256-${createHash("sha256").update(source, "utf8").digest("base64")}'`;
}

export function assertSafeStaticHtml(html) {
  if (/<base\b/i.test(html)) throw new Error("Static HTML must not redefine the document base URL");
  if (/\son[a-z]+\s*=/i.test(html)) throw new Error("Static HTML contains an inline event handler");
  if (/\b(?:href|src)\s*=\s*["']\s*javascript:/i.test(html)) {
    throw new Error("Static HTML contains a javascript: URL");
  }
}

export function buildContentSecurityPolicy(html) {
  assertSafeStaticHtml(html);
  const scriptHashes = [...new Set(inlineElementSources(html, "script").map(sourceHash))];
  const styleHashes = [...new Set(inlineElementSources(html, "style").map(sourceHash))];

  return [
    "default-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "form-action 'none'",
    `script-src 'self' ${scriptHashes.join(" ")}`,
    "script-src-attr 'none'",
    `style-src 'self' ${styleHashes.join(" ")}`,
    "style-src-attr 'none'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self'",
    "media-src 'none'",
    "manifest-src 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export function buildPagesHeaders(html, assetNames, workerName) {
  const csp = buildContentSecurityPolicy(html);
  const immutableAssetRules = [...assetNames]
    .sort((left, right) => left.localeCompare(right))
    .map((name) => {
      const contentType = name === workerName
        ? "\n  Content-Type: application/javascript; charset=utf-8"
        : "";
      return `/assets/${name}\n  Cache-Control: public, max-age=31536000, immutable${contentType}`;
    })
    .join("\n\n");

  return `/*
  Content-Security-Policy: ${csp}
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Resource-Policy: same-origin
  Permissions-Policy: accelerometer=(), ambient-light-sensor=(), browsing-topics=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()
  Referrer-Policy: no-referrer
  Strict-Transport-Security: max-age=31536000
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  X-XSS-Protection: 0

/
  Cache-Control: public, max-age=0, must-revalidate

/index.html
  Cache-Control: public, max-age=0, must-revalidate

/404.html
  Cache-Control: no-store

/favicon.svg
  Cache-Control: public, max-age=86400, must-revalidate

/og-postage.png
  Cache-Control: public, max-age=86400, must-revalidate

${immutableAssetRules}
`;
}
