---
name: soul-keeper-before-compaction
description: Snapshot and encrypt agent workspace before context compaction
metadata:
  openclaw:
    emoji: 🦞
    events:
      - before_compaction
    requires:
      - node>=20
---

This hook captures the workspace memory files (MEMORY.md, SOUL.md, AGENTS.md, etc.) before OpenClaw compacts the conversation. The encrypted bundle is saved locally; a detached uploader pushes the CID to FOC asynchronously.
