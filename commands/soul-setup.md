---
name: soul-setup
description: One-time setup — set master password, cache it for hooks/uploader, and provision session key on chain
---

Run the setup flow. The skill root is the skill's installed directory (e.g. `~/.claude/skills/soul-keeper`); `cd` there before running `node ...` commands so `import { ... } from './lib/...'` resolves correctly.

1. **Idempotency check.** Look at the runtime state dir to find the soul-keeper config (`~/.claude/soul-keeper/config.json` for Claude Code, `~/.openclaw/soul-keeper/config.json` for OpenClaw). If it exists with a `passwordHash` field, tell the user "Soul Keeper is already set up. Use `/soul backup` to make a snapshot." and stop.

2. **Prompt for password.** Ask the user for a master password (≥8 chars). Confirm by asking twice. Treat the password as sensitive — never print it back.

3. **Derive identity and write three files.** Run one Bash invocation from the skill root that:
   - derives the AES key and EVM session key from the password,
   - writes the SHA-256 hash of the password to `config.json`,
   - writes the raw password to `<stateDir>/soul-keeper/.session-password` so the detached uploader and PreCompact hook can derive the session key on demand without prompting again.

   ```bash
   node -e "
     const pw = process.argv[1];
     const path = require('node:path');
     const fs = require('node:fs');
     const { createHash } = require('node:crypto');
     (async () => {
       const wallet = await import('./lib/wallet.mjs');
       const { saveConfig } = await import('./lib/config.mjs');
       const { detectRuntime } = await import('./lib/runtime/index.mjs');
       const rt = detectRuntime();
       const stateDir = rt.stateDir();
       const all = await wallet.deriveAll(pw);
       const passwordHash = createHash('sha256').update(pw).digest('hex');
       await saveConfig({ stateDir }, { passwordHash, network: 'calibration' });
       const skDir = path.join(stateDir, 'soul-keeper');
       fs.mkdirSync(skDir, { recursive: true });
       fs.writeFileSync(path.join(skDir, '.session-password'), pw, { mode: 0o600 });
       console.log(JSON.stringify({ sessionAddress: all.sessionAddress }));
     })();
   " '<password>'
   ```

   Capture the printed `sessionAddress` for step 4.

4. **One-time on-chain session-key login.** Authorize the user's derived address as a session key of the embedded sponsor wallet. This is one Calibration tx; takes ~30 seconds to confirm.

   ```bash
   node -e "
     const sessionAddress = process.argv[1];
     (async () => {
       const { loginUserSessionKey } = await import('./lib/foc.mjs');
       const { getSponsor } = await import('./lib/sponsor.mjs');
       const sponsor = getSponsor({ network: 'calibration' });
       const { txHash } = await loginUserSessionKey({
         sponsorKey: sponsor.privateKey,
         userSessionAddress: sessionAddress,
         rpcUrl: sponsor.rpcUrl,
       });
       console.log('login tx:', txHash);
     })();
   " '<sessionAddress>'
   ```

   If `getSponsor` throws `SPONSOR_KEY is not configured`, tell the user: "Sponsor not configured. Ask the skill author for the demo key, or set `userPrivateKey` in config to BYOK mode."

5. **Confirm.** "✅ Soul Keeper is ready. Try `/soul backup`."
