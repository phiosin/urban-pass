# Project rules (shared by Codex and Claude Code)

Two AI agents, Codex and Claude Code, take turns on this repository like two senior developers sharing a codebase. Neither remembers the other's conversation; **this file, `HANDOFF.md` and git history are the only shared memory.** Write them so the next agent can start working within minutes, without asking or re-exploring. This file is the single source of rules for both (Claude reads it via `CLAUDE.md`).

## Start of every session
1. `git pull` (if there is a remote), then `git status`. If there are uncommitted changes you didn't make, stop and ask the user what they are. Never commit or discard them blindly.
2. Read `HANDOFF.md`, then `git log --oneline -10`. If the other agent committed since your last session, skim its diff (`git show --stat`, then the relevant hunks) like a code review. Flag problems instead of silently rewriting its work.
3. Read only the files you need. HANDOFF.md tells you where to look.

## Commits, pushes and handoffs
- **During a session:** use your judgement. Commit at sensible checkpoints (a working feature or fix, before a risky change) and update `HANDOFF.md` when something meaningful changed. No need to commit or push after every small step.
- **End of every session (mandatory):** update `HANDOFF.md`, **commit** everything (half-done work gets a clear `WIP:` message, or goes on a `wip/<name>` branch, and is noted in HANDOFF.md), then **push** if the repo has a remote, unless the user said not to. The other agent must find the full current state in the repo, at least locally.
- Never leave uncommitted work behind at the end of a session.

## HANDOFF.md
Whenever you update it, rewrite it (don't append a diary), keeping it under ~50 lines, with these sections:
- **Where this is going**: the goal and the bigger direction or roadmap (stable, rarely changes).
- **Last step**: what was just done, by which agent, date, and the commit(s).
- **Current state**: what works, what's half-done (with file paths), any open branch.
- **Next steps**: concrete, ordered and actionable, so the next agent can start on #1 immediately.
- **Problems so far**: bugs, dead ends and failed approaches (and why they failed), so nobody repeats them.
- **Decisions**: one line each, with the why.

Lasting preferences or rules the user states ("always…", "never…") go into **this file** (Project specifics), not only into an agent's private memory, so the other agent knows them too.

## Git workflow
- Small, focused commits, each one working (tests pass). Message: imperative summary line, then a short **why** in the body. The "why" is the part the other agent can't recover otherwise.
- Never rewrite shared history (`push --force`, rebasing pushed commits, `reset --hard` on others' work).
- Commit only files you changed for this task. No unrelated reformatting or drive-by refactors.
- Risky or large changes go on a branch (`feat/<name>`), noted in HANDOFF.md.
- **Codex:** run each git command as its own shell call (e.g. `git add -A`, then `git commit -m "..."`, then `git push`), never chained with other commands in one call. Standalone git commands are pre-approved (`~/.codex/rules/default.rules`); chained ones hit the sandbox, which protects `.git`.

## Quality bar
- Understand before changing: read the surrounding code and follow existing conventions.
- Run the relevant tests or build before committing. Add tests for new behaviour where the project has tests.
- Prefer simple, readable solutions.
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
