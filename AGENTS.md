# Project rules (shared by Codex and Claude Code)

Two AI agents, Codex and Claude Code, take turns on this repository like two senior developers sharing a codebase. Neither remembers the other's conversation; **this file, `HANDOFF.md` and git history are the only shared memory.** This file is the single source of rules for both (Claude reads it via `CLAUDE.md`).

## Start of every session
1. `git status`: if there are uncommitted changes you didn't make, stop and ask the user what they are. Never commit or discard them blindly.
2. Read `HANDOFF.md`, then `git log --oneline -10`. If the other agent committed since your last session, skim its diff (`git show --stat`, then the relevant hunks) like a code review. Flag problems instead of silently rewriting its work.
3. Read only the files you need. HANDOFF.md tells you where to look.

## Git workflow
- Small, focused commits, each one working (tests pass). Message: imperative summary line, then a short **why** in the body. The "why" is the part the other agent can't recover otherwise.
- Commit at every meaningful checkpoint. Never end a session with uncommitted work.
- Never rewrite shared history (`push --force`, `rebase` of pushed commits, `reset --hard` on others' work). Push only when the user asks or the project's specifics say so.
- Commit only files you changed for this task. No unrelated reformatting or drive-by refactors.
- Risky or large changes go on a branch (`feat/<name>`); note the branch in HANDOFF.md.

## Shared memory: HANDOFF.md
After each bigger step and before stopping, rewrite (don't append to) `HANDOFF.md`, keeping it under ~40 lines:
- **Goal**, **Current state** (what works, what's half done, with paths), **Next steps**, **Decisions** (one line + why each), **Gotchas** (what wasted time).
- Include it in the commit of that step.

Lasting preferences or rules the user states ("always…", "never…") go into **this file** (Project specifics), not only into your private memory, so the other agent knows them too.

## Quality bar
- Understand before changing: read the surrounding code and follow existing conventions.
- Run the relevant tests/build before committing. Add tests for new behaviour where the project has tests.
- Prefer simple, readable solutions. Leave the code better than you found it, within the task's scope.
- If a requirement is ambiguous and the choice matters, ask the user rather than guess.
- No secrets in code, commits or HANDOFF.md. Keys live in `.env` (git-ignored).

## Model choice (Codex)
- Default `gpt-6-luna`. Switch to `gpt-6-astra` (`/model`) only for hard problems: tricky algorithms, subtle bugs luna failed on twice, or big design changes. Switch back afterwards.

## Project specifics
- Setup: Python 3.10+; crawler uses only the standard library. Optional `uv` is used in the README commands.
- Login once: `uv run --no-project --python 3.12 python -m urbanpass.login` (prompts locally; password is not saved).
- Build data: `uv run --no-project --python 3.12 python -m urbanpass --days 7` (writes `wordpress/urban-pass/data/`).
- Preview: run `python -m http.server` at the repo root, then open `http://localhost:8000/dev/`.
- Tests: no automated tests yet.
- Deploy: GitHub Actions `Refresh class data` is manual; `Deploy site` runs on `main` changes to `wordpress/urban-pass/**` or `web/**`, and can also be run manually. No local build command.
- Architecture: `urbanpass/` contains Python USC/Wellpass crawlers, auth, matching, station lookup and CLI (`__main__.py`); `wordpress/urban-pass/` holds the shared app JS/CSS, plugin PHP/templates and generated JSON; `web/index.html` is the GitHub Pages shell; `dev/index.html` is the local preview; `.github/workflows/` refreshes data and deploys Pages.
- Conventions: standard-library Python, browser-native JavaScript/CSS, and a small PHP WordPress wrapper; generated app data is compact JSON. There is no package manifest or frontend build tooling.

### User decisions
- Hosted free on GitHub Pages: https://phiosin.github.io/urban-pass/ (2026-10-22). Custom domain `pass.orajati.com` was offered and declined for now.
- Class data refresh is manual only: Actions -> “Refresh class data” -> Run workflow. It needs the GitHub secret `WELLPASS_REFRESH_TOKEN`, set by the user.
- WordPress.com plan is Premium (`orajati.com`): no plugins, GitHub Deployments or custom JS. Do not suggest WordPress plugin deployment unless the plan is upgraded to Business. Keep `wordpress/urban-pass/` as the shared app source for Pages.
- The local Wellpass login token lives only in `.secrets/wellpass.json`. Never read or print it.
