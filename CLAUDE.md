@AGENTS.md

# Claude Code specifics
- Read `HANDOFF.md` at the start; update it and commit after each bigger step (see AGENTS.md).
- To save Claude tokens, delegate coding to Codex with the `codex` skill: default model `gpt-6-luna`, `gpt-6-astra` only for hard problems. Write a short brief, run it in the background, check `git diff --stat` and the tests, and report briefly.
- Do quick questions and one-line edits yourself when that's cheaper than briefing Codex.
