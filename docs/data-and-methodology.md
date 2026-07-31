# Data and methodology

## Purpose

The bundled dataset provides a reproducible snapshot for a static calculator. It is not a live mirror of every China Post system and should not be interpreted as a guarantee that a particular office will accept a mailing.

## Sources in this repository

- `data/postage-rates.zh-CN.md` is the reviewed Chinese rate and legal-combination working table. Generated markers hold the domestic parcel matrix and international parcel tables consumed by the build.
- `data/stamp-denominations.tsv` is the ordinary-stamp denomination source used to derive the built-in values.
- `app/postage-data.json` is deterministic generated output used at runtime.
- `app/destination-data.json` combines the postage snapshot with ISO country material, reviewed aliases, postal-system-specific destinations, and the documented November 2025 route-mode snapshot.
- `docs/official-calculator-comparison.zh-CN.md` records comparison observations against China Post's 11185 calculator and deliberately preserves disagreements instead of silently choosing one system.

The Chinese working table links the relevant public sources and identifies limits or third-party observations. A source being listed does not imply endorsement by its operator.

## Data rules

- Currency is stored as integer fen.
- Calculation weights are stored as integer grams. The UI may accept kilograms and converts them exactly rather than applying an undocumented display-rounding shortcut.
- Destinations that appear separately in postal counter systems remain separate even when they share an ISO code or upstream postal route.
- Simplified Chinese display names follow common Mainland Chinese usage; aliases preserve common alternatives for search.
- Unstable or third-party route information is labeled and may be filtered by transport mode.
- Product combinations unavailable at a universal-service counter are excluded from the stamp calculator.

## Updating data

1. Record the public source, observation date, and affected rule.
2. Update the reviewed source under `data/` or the destination generator.
3. Run `npm run data:generate`.
4. Review the generated JSON diff; unexpected bulk changes should stop the update.
5. Add focused fixtures for the changed service, destination, boundary weight, or surcharge.
6. Run `npm run check` and document unresolved conflicts in the pull request.

Do not remove an inconsistency merely to make two calculators agree. Postal systems, public pages, and counter software can diverge; preserving the evidence and qualification is more useful than false precision.

## Licensing and attribution

Project code is MIT licensed. The structured datasets and the country-data attribution are governed by [`DATA_LICENSES.md`](../DATA_LICENSES.md), including the ODbL terms inherited from `world-countries`. Postal prices, place names, service names, and other facts are included for interoperability and calculation. Third-party names, source-page content, and trademarks remain subject to their respective rights. Contributors should quote only what is necessary and prefer original analysis or structured facts over copied prose.
