# Contributing

Thank you for helping improve StampHelper.

## Before you start

- Use an issue for material rate, route, or product changes so the evidence can be reviewed first.
- Never commit credentials, personal postal records, tracking numbers, address data, browser profiles, `.env` files, private keys, or production exports.
- Keep factual postal claims tied to a source and an effective or observation date.
- Preserve integer-fen money calculations and the optimizer's documented ordering rules.

## Development workflow

1. Fork the repository and create a focused branch.
2. Install Node.js `>=22.13.0` and run `npm ci`.
3. Make the smallest coherent change.
4. Add or update tests for formula, data, UI-state, security, or performance behavior.
5. Run the complete local gate:

   ```bash
   npm run lint
   npm audit
   npm test
   npm run pack:inspect
   ```

6. Review `git diff --check` and the files included by `npm pack --dry-run`.
7. Sign commits with an SSH or GPG key recognized by GitHub. The protected branch requires verified signatures.
8. Open a pull request using the repository template.

## Data changes

The reviewed source snapshot is under `data/`. Run `npm run data:generate` after changing it, then commit both the source and generated JSON. A data PR should explain the source, observation date, affected services or destinations, and any unresolved conflict.

Do not silently resolve conflicting official systems. Record the discrepancy and keep the UI wording appropriately qualified.

## Code style

- Keep money in integer fen and weights in integer grams at calculation boundaries.
- Keep domain logic in `lib/`; React components should orchestrate and render it.
- Validate all persisted or generated data at trust boundaries.
- Avoid runtime dependencies and network calls unless the privacy and security implications are documented.
- Keep user-facing Simplified Chinese terminology consistent with Mainland Chinese postal usage.

## Pull requests

Pull requests should describe what changed, why it changed, user impact, evidence for postal-data changes, security/privacy implications, and validation performed. Maintainers may request smaller commits or additional fixtures when a change affects several independent rules.

By contributing, you agree that your contribution is licensed under the repository's MIT License.
