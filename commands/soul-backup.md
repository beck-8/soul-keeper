---
name: soul-backup
description: Snapshot, encrypt, and queue upload to FOC
---

Run a manual backup:

1. Resolve runtime via `node -e "import('./lib/runtime/index.mjs').then(m => console.log(m.detectRuntime().name))"`.

2. Resolve default backup sources from the runtime adapter (`runtime.defaultBackupSources(cwd)`).

3. Bundle them via `lib/bundle.mjs createBundle({ sources, baseDir })`.

4. Encrypt with the master password (prompt user; the password is not persisted across sessions in plaintext):
   `node -e "import('./lib/crypto.mjs').then(m => m.encryptBundle(bundleBytes, pw))"`

5. Write the encrypted bytes to `<stateDir>/soul-keeper/pending/<timestamp>-<short-hash>.enc` and call `addSnapshot` from `lib/index-store.mjs` with `status: 'pending'` and full metadata (id, createdAt, trigger='manual', scope, localPath, sizeBytes).

6. Spawn detached uploader:
   `node lib/uploader.mjs --stateDir=<...> --sessionKey=<derived-session-private-key>` (detached, stdio ignored).

7. Tell the user: "✅ Snapshot saved locally. CID will populate in 1–2 min. Use `/soul list` to check status."
