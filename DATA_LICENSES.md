# Data licenses and attribution

StampHelper separates software licensing from structured-data licensing.

## Project code

Source code, tests, build scripts, and project-authored interface assets are licensed under the [MIT License](LICENSE).

## Structured datasets

The database rights, if any, in the structured datasets under `app/` and `data/` are made available under the [Open Data Commons Open Database License 1.0 (ODbL-1.0)](https://opendatacommons.org/licenses/odbl/1-0/).

This includes:

- `app/destination-data.json`;
- `app/postage-data.json`;
- `data/postage-rates.zh-CN.md` where it contains machine-readable rate matrices and tables;
- `data/stamp-denominations.tsv`.

Individual facts may not be subject to copyright or database rights in every jurisdiction. This notice does not claim rights that do not exist, and it does not grant rights in third-party trademarks, copied source-page expression, or personal information.

## Country database attribution

Destination generation uses [`world-countries`](https://github.com/mledoze/countries), version 5.1.0, by Mohammed Le Doze. That database is made available under ODbL-1.0. StampHelper publishes the transformed destination database, the transformation generator, reviewed aliases, and postal-specific additions so recipients can inspect and reproduce the result.

Required notice:

> Contains information from the world-countries database, which is made available under the Open Database License (ODbL).

## Postal references

Postal prices, route labels, service names, and place names are factual inputs assembled from the public references linked in the working documents. China Post and other third parties retain their trademarks and any rights in their original publications. StampHelper is independent and does not imply affiliation or endorsement.

When redistributing a substantial part of these datasets or a derivative database, retain this notice and comply with ODbL-1.0, including applicable share-alike and access-to-derivative-database requirements.
