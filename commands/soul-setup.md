---
name: soul-setup
description: One-time setup — set master password and provision session key
---

Run the setup flow:

1. If `~/<runtime-state-dir>/soul-keeper/config.json` already has a `passwordHash`, tell the user "Soul Keeper is already set up. Use `/soul backup` to make a snapshot." and stop.

2. Prompt the user for a master password (≥8 chars). Confirm by asking twice. Use the Bash tool to invoke:

   `node -e "import('./lib/wallet.mjs').then(async m => { const all = await m.deriveAll(process.argv[1]); console.log(JSON.stringify({sessionAddress: all.sessionAddress})) })" <password>`

3. Save a SHA-256 hash of the password to `config.json` via `lib/config.mjs` (so future `/soul setup` recognizes setup is done; do NOT store password plaintext).

4. Run one-time on-chain session-key login:

   `node -e "import('./lib/foc.mjs').then(m => m.loginUserSessionKey({ sponsorKey, userSessionAddress, rpcUrl }))"`

   Source `sponsorKey` and `rpcUrl` from `lib/sponsor.mjs`'s `getSponsor({network:'calibration'})`. If `getSponsor` throws because `SPONSOR_KEY` is empty, output: "Sponsor not configured. Ask the skill author for the demo key, or set `userPrivateKey` in config to BYOK mode."

5. Confirm: "✅ Soul Keeper is ready. Try `/soul backup`."
