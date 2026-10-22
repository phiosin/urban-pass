# Plan: ask an AI assistant about Urban Pass (MCP)

Status: **idea only, not built.**

## What it would do

You ask in Claude (or ChatGPT): *"My friend has USC Classic. Is there yoga after 18:00 tomorrow in Kreuzberg we can both book?"* The assistant calls Urban Pass, gets the matching classes and courts, and answers with times, studios and booking links.

## How: an MCP server

MCP (Model Context Protocol) is the standard way to give Claude, and now also ChatGPT, extra tools. The server would offer a few read-only tools:

| Tool | Input | Returns |
|---|---|---|
| `find_classes` | date, activities, USC plan, time rule (at/after/before), district, only-on-both | classes with time, studio, spots, booking links |
| `find_places` | activity (padel, swimming, …), USC plan, +1 only | courts/pools/gyms with who covers the entry (incl. Wellpass discount) |
| `studio_details` | studio name | address, nearest U/S-Bahn, terms, today's classes |
| `list_activities` | – | the activity names you can filter by |

It reads the same data the website uses (`data/index.json` and the day files on GitHub Pages), so there's no second database, and **no login or secrets are exposed**. The Wellpass token stays where it is (on your PC or in the GitHub secret).

## Options and cost

| Option | Works in | Hosting | Extra cost |
|---|---|---|---|
| **A. Local MCP server** (small Python script) | Claude Desktop, Claude Code | your PC | none |
| **B. Remote MCP server** (public HTTPS URL) | Claude on web and phone ("custom connector"), ChatGPT (apps/connectors in developer mode) | Cloudflare Workers or similar, free tier is enough | none for hosting; needs a Claude plan with custom connectors (your Pro plan has them) and ChatGPT Plus/Pro on the OpenAI side |
| **C. Own chat box on the website** using the OpenAI or Claude API | anyone visiting the site | GitHub Pages can't hold an API key safely, so it needs a small server (e.g. a Cloudflare Worker) | pay per question: roughly €0.001–0.01 per question with a small model; set a monthly cap |

**Recommendation:** start with **A** (about an hour, free). Then do **B** if you want it on your phone in the Claude app. **C** is only worth it if friends without Claude or ChatGPT should use it.

## What it needs

- About 150–250 lines of code: the tools above, reusing the filter rules from the app (plan, +1, time rule, "access mode" for courts and pools).
- For B: a free Cloudflare account and one deploy command. No authentication is needed, since the data is already public.
- Data freshness is the same as the website: whatever the last "Refresh class data" run produced. The AI should mention when the data is from.

## Caveats

- The data comes from unofficial sources (USC website, Wellpass finder and app). Same terms caveats as the website.
- Answers are only as current as the last data refresh. Spots change quickly, so the AI should always link to the booking page.
