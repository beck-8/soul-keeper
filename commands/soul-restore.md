---
name: soul-restore
description: Restore the latest snapshot — local first, FOC fallback
---

Run restore:

1. List snapshots via `lib/index-store.mjs listSnapshots`. Pick the most recent.

2. If the local `.enc` file exists in `<stateDir>/soul-keeper/<localPath>`, decrypt it locally. Otherwise, download from FOC using `lib/foc.mjs downloadBundle({ pieceCid: snap.cid, sponsorKey, sessionPrivateKey, rpcUrl })`.

3. Decrypt with the master password (prompt the user) using `lib/crypto.mjs decryptBundle`.

4. Extract to a temp directory using `lib/bundle.mjs extractBundle(bytes, tmpDir)`.

5. Atomically move the extracted files into the runtime memory locations. Do NOT touch existing files until extraction succeeds. Use rename-or-copy-then-delete patterns.

6. Tell the user: "✅ Restored from snapshot <id> (<createdAt>). Files written: <count>."

If decryption fails (wrong password): "❌ Wrong password. Nothing was written."
If FOC download fails: "❌ Snapshot CID <cid> unreachable. Try again later."
