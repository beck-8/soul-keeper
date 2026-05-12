---
name: soul-keeper-agent-bootstrap
description: Surface available snapshots when an agent session starts
metadata:
  openclaw:
    emoji: 🦞
    events:
      - agent:bootstrap
---

On agent startup, check if Soul Keeper has any snapshots and remind the agent to consider `/soul restore` if appropriate.
