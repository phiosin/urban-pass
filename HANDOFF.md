# Handoff

## Where this is going
- Help people in Berlin with Urban Sports Club (USC) and Wellpass find studios and classes available to both; also list courts and other venues available through either pass, Wellpass Plus1 and discount terms, and external booking links.
- Keep the app as a simple static Pages site with a filterable map/list, activity and USC-plan selection, class times, and station context. Berlin is the current scope.

## Last step
- _Claude — 2026-10-22_: added shared agent rules (`AGENTS.md`, `CLAUDE.md`, `HANDOFF.md`) for Codex/Claude handoffs; commit and push after every step.
- Last real development step before the agent-setup commits: `805e526` — activity filter with drop-in studios and studio name labels on map pins.

## Current state
- `urbanpass/` builds shared studio flags, courts, and unmatched Wellpass `plus1_places` in `index.json`; `wellpass.py` reads Plus1 fields and direct/nested external booking links.
- `urbanpass/catalog.py` classifies courts and discount terms and builds platform coverage records.
- `wordpress/urban-pass/assets/app.js` and `app.css` provide the USC plan picker, courts and Plus1 filters, badges, map pins, details, and About legend.
- `dev/check_offline.py` builds records from cache only. Tracked `index.json` has `courts` and `plus1_places`; this supersedes the earlier note that generated JSON still had the old schema.

## Next steps
1. Rebuild data with `uv run --no-project --python 3.12 python -m urbanpass --days 7` (`$env:PYTHONUTF8='1'` in Windows PowerShell) before relying on fresh schedule data.
2. Review the refreshed map and lists. USC-only courts have no coordinates in cached USC records and remain list-only until coordinates are available.

## Problems so far
- USC venue summaries have no coordinates in the current cache, so USC-only court pins cannot be placed accurately; cards include a map-location note.
- Padel City terms in cache say `1/4 anteilige Platzmiete` for 90 minutes; its external link is nested at `externalBookingInfo.channel.link`.
- The matcher still has some false matches; `docs/approach.md` says it needs tuning before match counts can be trusted.
- Wellpass crawling and class verification need network access and local auth. The token is only in `.secrets/wellpass.json`; never read or print it.
- The crawlers use unofficial endpoints that can change without notice.

## Decisions
- Keep Berlin, the standard-library crawler, and `wordpress/urban-pass/` as the shared Pages app source. WordPress.com Premium does not support plugin deployment; do not suggest it unless the plan changes.
- Class data refresh is manual through Actions → “Refresh class data” → Run workflow; GitHub needs the user-set `WELLPASS_REFRESH_TOKEN` secret.
- Plus1 is true when `membershipTypes` includes `PLUS_1` or `qualitrainPlusOneGym` is true; cached Berlin data had 733 from each field with no disagreements.
- Courts include racket sports and common rentable ball courts; show platform coverage and deduplicate shared records by Wellpass venue.
- External booking links prefer `externalBookingInfo.link` or its channel link, then the venue website for courts.
