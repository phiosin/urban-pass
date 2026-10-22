# Handoff

_Last updated by: Codex — 2026-10-22_

## Goal
Show Berlin fitness options across USC and Wellpass, including joint classes, courts, Wellpass Plus1 places, discounts, and external booking.

## Current state
- `urbanpass/` builds shared studio flags plus `courts` and unmatched `plus1_places` in `index.json`; `wellpass.py` reads Plus1 fields and direct/nested external booking links.
- `urbanpass/catalog.py` classifies courts and discount terms and builds platform coverage records.
- `wordpress/urban-pass/assets/app.js` + `app.css` have the remembered USC plan picker, courts and Plus1 filters, badges, map pins, details, and About legend.
- `dev/check_offline.py` builds records from cache only. The tracked generated JSON is still the old schema; no full refresh or push was done.

## Next steps
1. Rebuild data with `uv run --no-project --python 3.12 python -m urbanpass --days 7` (set `PYTHONUTF8=1` in Windows shells) before expecting the new data-backed UI sections to populate.
2. Review the refreshed map and lists; USC-only courts have no coordinates in the current cached USC records and remain list-only until coordinates are available.

## Decisions
- Keep Berlin, the standard-library crawler, and `wordpress/urban-pass/` as the shared Pages app source.
- Plus1 is true when either `membershipTypes` includes `PLUS_1` or `qualitrainPlusOneGym` is true; cached Berlin data had 733 from each field with no disagreements.
- Courts include racket sports and common rentable ball courts; coverage is shown per platform, with shared records deduplicated by Wellpass venue.
- External links prefer `externalBookingInfo.link` or its channel link, then the venue website for courts.

## Gotchas
- USC venue summaries have no coordinates in the current cache, so USC-only court pins cannot be placed accurately; cards include a map-location note.
- Padel City terms in cache say `1/4 anteilige Platzmiete` for 90 minutes, and its external link is nested under `externalBookingInfo.channel.link`.
- Wellpass crawling/class verification needs network and local auth. Never read or print `.secrets/wellpass.json`.
