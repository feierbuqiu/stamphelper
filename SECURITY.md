# Security Policy

## Supported versions

Security fixes are applied to the latest release and the `main` branch.

| Version | Supported |
| --- | --- |
| 1.x | Yes |
| < 1.0 | No |

## Reporting a vulnerability

Please do not disclose suspected vulnerabilities in a public issue, discussion, or pull request.

Use [GitHub private vulnerability reporting](https://github.com/feierbuqiu/stamphelper/security/advisories/new) and include:

- the affected URL, release, commit, or package version;
- a minimal reproduction or proof of concept;
- the expected and observed impact;
- any suggested mitigation;
- whether the report is subject to a disclosure deadline.

You should receive an acknowledgement through the advisory within seven days. Confirmed issues will be assessed, fixed on a private branch when appropriate, and disclosed with coordinated release notes.

## Scope

The current production application is static and has no account system, application API, database, or server-side mutation endpoint. Relevant reports may include DOM-based XSS, CSP bypasses, compromised build or package content, dependency-chain attacks, unsafe persistence handling, Worker isolation failures, and accidental disclosure in published artifacts.

Reports that require a future backend should be treated as architecture feedback rather than a current exploit. Browser extensions, locally modified storage, self-XSS, denial of service against third-party infrastructure, and stale postal-rate disagreements without a security impact are normally out of scope.

## Safe research

Do not access other users' data, degrade the public service, automate high-volume traffic, or retain data that is not yours. Stop testing and report privately if you encounter unexpected sensitive information.
