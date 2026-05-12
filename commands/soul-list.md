---
name: soul-list
description: Show all snapshots with CID and status
---

Run: `node -e "import('./lib/index-store.mjs').then(async m => console.table(await m.listSnapshots({ stateDir })))"`

Format output as a table with columns: id, createdAt, status, cid (or "—" if pending), sizeBytes.

If any row has status=failed, append a warning: "⚠ <N> snapshot(s) failed to upload. They will retry on the next backup."
