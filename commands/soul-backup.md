---
name: soul-backup
description: Snapshot the agent's memory files, encrypt locally, and queue upload to Filecoin Onchain Cloud
---

Run a manual backup. `cd` into the skill root (e.g. `~/.claude/skills/soul-keeper`) before running any `node` command so relative imports resolve.

This whole flow runs in one Bash invocation. It reads the cached master password from `<stateDir>/soul-keeper/.session-password` (written by `/soul setup`); you do NOT need to prompt the user for it again.

```bash
node -e "
(async () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const { createHash } = require('node:crypto');
  const { spawn } = require('node:child_process');

  const { detectRuntime } = await import('./lib/runtime/index.mjs');
  const { createBundle } = await import('./lib/bundle.mjs');
  const { encryptBundle } = await import('./lib/crypto.mjs');
  const { addSnapshot } = await import('./lib/index-store.mjs');

  const rt = detectRuntime();
  const stateDir = rt.stateDir();
  const cwd = process.cwd();

  // Read cached password
  const pwFile = path.join(stateDir, 'soul-keeper', '.session-password');
  let password;
  try { password = fs.readFileSync(pwFile, 'utf8').trim(); }
  catch { throw new Error('No cached password. Run /soul setup first.'); }

  // Bundle the runtime's default sources
  const sources = rt.defaultBackupSources(cwd);
  const { bytes: bundleBytes, manifest } = await createBundle({
    sources, baseDir: cwd, scope: ['memory', 'soul'],
  });

  // Encrypt
  const encrypted = await encryptBundle(bundleBytes, password);

  // Write to pending/<id>.enc and record in index
  const id = new Date().toISOString().replaceAll(':', '-').slice(0, 19)
    + '-' + createHash('sha256').update(encrypted).digest('hex').slice(0, 8);
  const pendingDir = path.join(stateDir, 'soul-keeper', 'pending');
  fs.mkdirSync(pendingDir, { recursive: true });
  const localPath = 'pending/' + id + '.enc';
  fs.writeFileSync(path.join(stateDir, 'soul-keeper', localPath), encrypted);

  await addSnapshot({ stateDir }, {
    id,
    createdAt: new Date().toISOString(),
    trigger: 'manual',
    scope: ['memory', 'soul'],
    localPath,
    sizeBytes: encrypted.length,
    sha256: '',
    status: 'pending',
  });

  // Spawn detached uploader; it derives the session key from .session-password itself.
  spawn(process.execPath, ['lib/uploader.mjs', '--stateDir=' + stateDir], {
    detached: true,
    stdio: 'ignore',
    cwd: process.cwd(),
  }).unref();

  console.log('OK', id, encrypted.length);
})();
"
```

After it prints `OK <id> <bytes>`, tell the user: "✅ Snapshot saved locally. CID will populate in 1–2 min. Run `/soul list` to check status."

If the script throws because `.session-password` is missing, tell the user "Run `/soul setup` first."
