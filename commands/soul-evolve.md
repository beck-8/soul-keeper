---
name: soul-evolve
description: Synthesize updated SOUL.md from recent snapshot history
---

You are soul-keeper. Synthesize an updated SOUL.md from recent history.

1. Decrypt the last 5 snapshots into a temp directory. For each `uploaded` or `pending` snapshot in the most recent five, read its local `.enc` if available, otherwise download via `lib/foc.mjs downloadBundle`. Decrypt with the master password (prompt the user). Extract bundles into `<os.tmpdir()>/soul-keeper-evolve/`.

2. Read every file under that directory. For each, extract:
   - Memory entries (key facts, preferences, decisions)
   - Recurring workflows and tool patterns
   - Voice / phrasing patterns

3. If the runtime is OpenClaw, also read up to 14 most-recent `~/.openclaw/workspace/memory/YYYY-MM-DD.md` files as additional input.

4. Read the current SOUL.md (if any) — use it as scaffolding.

5. Synthesize an updated SOUL.md covering:
   - Role and working style
   - Recurring concerns and long-running projects
   - Tools and patterns this agent reaches for
   - Voice

6. Write to the runtime-appropriate location:
   - Claude Code: `<cwd>/soul.md`
   - OpenClaw: `~/.openclaw/workspace/SOUL.md`

   Preserve `[[name]]` links to memory entries.

7. Queue the new SOUL.md for the next backup by running `/soul backup`.

8. Report: what changed in SOUL.md (added sections, removed stale entries).
