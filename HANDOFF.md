# Handoff

## Where this is going
- Help people in Berlin with Urban Sports Club (USC) and Wellpass find classes and places they can book together; also courts/pools/gyms where one pass gets you in, Wellpass +1 places, discounts and external booking links.
- Simple static GitHub Pages app (https://phiosin.github.io/urban-pass/), mobile first. Berlin is the scope; Hamburg/Munich only for statistics.

## Last step
- _Claude — 2026-10-23_: fixed "Couldn't load this day" on every day. The landing rewrite had deleted `summaryText()`/`timeRuleText()` in `app.js`; `render()` threw and `selectDay()` showed the error as a failed download. Restored the helpers; `selectDay()` now only says "couldn't load" when the download fails (draw errors go to the console). Added `dev/serve.mjs` (Node preview server) because `uv`/Python stopped running in this shell.
- Before that (2026-10-22/23): landing page (16% claim, Kreuzberg-style `assets/landing-bg.svg`), setup screen (several activities, USC plan, +1 only, day, optional time rule), full-screen map with back button, "filtered out" pop-up, 3-city stats (`urbanpass/stats_cities.py` → `data/stats.json`).

## Current state
- Flow: landing → setup (`showSetup`) → map; settings cached in localStorage (`urbanpass.*`).
- Data: `wordpress/urban-pass/data/` has 7 days from 2026-10-22 plus `stats.json`; refresh via `python -m urbanpass --days 7` or the manual Action.
- Courts: all 58 have coordinates (USC-only ones via `usc.locations()` / studios-map).
- `urbanpass/http.py` uses a cookie session; `usc.use_city(id)` switches city (USC ignores `city_id` in list URLs).

## Next steps
1. Optional: AI/MCP hookup, see `docs/mcp-plan.md` (user said "not now").
2. Consider a tiny smoke test (node) that loads `app.js` with sample data and calls `render()` for each tab, so a missing helper is caught before deploy.

## Problems so far
- Big string/slice patches of `app.js` can silently delete neighbouring functions; check with `node --check` AND for undefined calls before pushing.
- In the Claude shell, `uv run … python` and the uv Python exited 127/2 silently on 2026-10-23; patches "applied" but nothing was written. Verify edits with grep. Use `node dev/serve.mjs 8766` for the preview.
- Matcher has a few false matches; Padel City Wellpass deal is ¼ of the 90-min court rent (not ½).
- Unofficial endpoints can change; Wellpass token only in `.secrets/wellpass.json` (never read/print).

## Decisions
- Hosting: GitHub Pages; WordPress.com Premium can't run the app, so don't suggest plugin deployment unless the plan is upgraded.
- Data refresh is manual (Actions → "Refresh class data"), needs secret `WELLPASS_REFRESH_TOKEN`.
- Landing claim uses all studios on either app as base (16% Berlin); Berlin kept because Hamburg (28%) / Munich (26%) overlap more.
- Courts/pools/gyms use "access mode": places where at least one pass gets you in, with an ⓘ coverage panel.
- Plus1 = `membershipTypes` has `PLUS_1` or `qualitrainPlusOneGym`.
