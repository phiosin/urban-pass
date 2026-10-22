# Handoff

_Last updated by: Codex (initial setup) — 2026-10-22_

## Goal
Show Berlin studios and classes that people with Urban Sports Club and Wellpass can both book.

## Current state
- `urbanpass/` crawls USC and Wellpass data, matches studios/classes and writes JSON to `wordpress/urban-pass/data/`.
- `wordpress/urban-pass/assets/` is the app UI; it has list/map views, activity filters and nearest transit station details. The same directory contains the WordPress wrapper.
- Wellpass app schedules are checked for shared studios with in-app booking when login is available; static app is served through `web/index.html` on GitHub Pages.
- Data refresh is a manual GitHub Actions workflow, followed by a Pages deploy. The site is public and marked `noindex`.
- No automated test suite is present (inferred from repository files and configuration).

## Next steps
1. Review and tune studio matches: `docs/approach.md` says current rough counts still include false matches.
2. No explicit TODO files were found; prioritize matcher corrections from observed false positives (inferred).

## Decisions
- Berlin is the initial scope; match USC and Wellpass studios using address plus name to reduce collisions (`docs/approach.md`).
- Keep the crawler/matcher in standard-library Python and the UI/data in `wordpress/urban-pass/`; Pages publishes the shared app files (history: `d79f79e`, `bf1679e`).
- Use an authenticated Wellpass app schedule check; classes match within five minutes, with name as a tie-breaker (`docs/approach.md`).
- Refresh class data on demand through GitHub Actions, then deploy Pages (history: `bf1679e`).

## Gotchas
- USC and Wellpass endpoints are unofficial and can change; requests are cached and deliberately spaced.
- Public data includes schedule details fetched with a personal Wellpass account; the site is marked `noindex`. GitHub Pages on private repos requires GitHub Pro.
- Never read or print `.secrets/wellpass.json`; it contains the local Wellpass refresh token.
