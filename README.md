# Soul Keeper 🦞

Let your agent's soul live encrypted, provable, cross-device, and self-evolving on Filecoin Onchain Cloud.

## What it does

- **Backup** — captures `MEMORY.md`, `SOUL.md`, and `memory/*` automatically on compact, or via `/soul backup`. Encrypted with your password; uploaded to FOC.
- **Restore** — fresh install + same password recovers your full soul on any device.
- **Evolve** — `/soul evolve` reads your history and synthesizes an updated `SOUL.md` on screen.

## Install

### OpenClaw

```bash
openclaw skills install soul-keeper
```

### Claude Code

```bash
git clone https://github.com/beck-8/soul-keeper ~/.claude/skills/soul-keeper
cd ~/.claude/skills/soul-keeper && pnpm install && node install.mjs
```

Then in your agent:

```
/soul setup
```

## Slash commands

| Command | What it does |
|---|---|
| `/soul setup` | One-time password setup |
| `/soul backup` | Snapshot now |
| `/soul restore` | Load latest snapshot |
| `/soul list` | Show all snapshots with CID + status |
| `/soul evolve` | Synthesize updated SOUL.md from history |

## How it works

```
password → PBKDF2 → AES-256-GCM key + EVM session key (zero funds)
memory files → tar.gz bundle → encrypted blob → FOC PieceCID
recovery: same password → same EVM address → discover datasets on chain
```

A demo sponsor wallet (`0xDEMO`) on Calibration testnet pays for storage. Per-user allowance is capped via `synapse-sdk` session keys. The user's derived wallet never holds funds.

## Bring your own key

Set `userPrivateKey` in `~/<runtime-state-dir>/soul-keeper/config.json` to pay for storage yourself.

## Security note

This is a POC. The Calibration sponsor key is embedded in `lib/sponsor.mjs` for the 24h Mu demo. Do not reuse this pattern in production — migrate to a sponsor service before mainnet.

## Architecture

```
soul-keeper/
├── SKILL.md                    # Skill entry (Claude Code + OpenClaw)
├── plugin.json                 # ClawHub metadata
├── install.mjs                 # Detects runtime, registers hooks
├── commands/                   # 5 slash command templates
├── lib/
│   ├── wallet.mjs              # PBKDF2 → AES key + EVM session key
│   ├── crypto.mjs              # foc-encryption wrapper
│   ├── bundle.mjs              # tar.gz + manifest
│   ├── foc.mjs                 # synapse-sdk wrapper (upload/download/discover)
│   ├── uploader.mjs            # Detached background uploader
│   ├── sponsor.mjs             # 0xDEMO paymaster constants
│   ├── config.mjs              # Local config CRUD
│   ├── index-store.mjs         # Snapshot index CRUD
│   └── runtime/                # claude-code + openclaw adapters
├── runtimes/
│   ├── claude-code/hooks/      # PreCompact, SessionStart shell entries
│   └── openclaw/hooks/         # before_compaction, agent:bootstrap handlers
├── vendor/foc-encryption/      # Vendored AES-256-GCM COSE encryption
├── scripts/                    # gen-wallet, setup-sponsor, revoke-all
├── test/                       # Vitest unit + integration + e2e
└── docs/
    ├── specs/                  # Design spec
    └── plans/                  # Implementation plan
```

## Development

```bash
pnpm install
pnpm test           # unit + integration
pnpm test:e2e       # E2E against Calibration (requires SPONSOR_KEY)
pnpm lint:fix
```

## License

Apache-2.0 OR MIT
