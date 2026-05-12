---
name: soul-keeper
description: Encrypt, persist, and self-evolve your agent's soul on Filecoin. Use when the user mentions backing up agent memory, restoring an agent's state, or synthesizing/updating SOUL.md from history. Triggers automatically on context compaction.
metadata:
  emoji: 🦞
  category: persistence
  homepage: https://github.com/beck-8/soul-keeper
---

Soul Keeper backs up the agent's local memory files (MEMORY.md, SOUL.md, memory/*) to Filecoin Onchain Cloud (FOC), encrypted client-side with a password-derived AES-256-GCM key.

## When to use

- User says: "back up my memory", "snapshot my soul", "remember this state".
- User starts a fresh session — surface restore prompt automatically.
- Before context compaction — capture state automatically.
- User wants to update SOUL.md from accumulated history — run `/soul evolve`.

## Slash commands

- `/soul setup` — one-time password setup
- `/soul backup` — snapshot now
- `/soul restore` — load latest snapshot
- `/soul list` — show all snapshots
- `/soul evolve` — synthesize updated SOUL.md from history

## How it works

1. **Encryption**: password → PBKDF2 → AES-256-GCM key → COSE envelope.
2. **Storage**: encrypted bundle uploaded to FOC via synapse-sdk on Calibration testnet. PieceCID identifies the blob.
3. **Sponsor**: embedded demo wallet pays for storage; user wallet derived from password holds zero funds.
4. **Cross-device**: same password → same derived EVM address → discovers own datasets on chain.

## Privacy

Password never leaves the user's machine. Server / sponsor sees only encrypted bytes and CIDs.

## Limits (POC)

- Calibration testnet only (no mainnet).
- Full restore only (no selective).
- Single-recipient encryption.
