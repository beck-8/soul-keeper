# Soul Keeper — Design Spec

**Date**: 2026-05-12
**Status**: Draft for review
**Owner**: beck-8
**Audience**: Implementers of the POC; Mu builders reading the demo repo

---

## 1. One-Liner

Soul Keeper lets an AI agent's soul (memory + personality file) live encrypted, provable, cross-device, and self-evolving on Filecoin Onchain Cloud (FOC).

## 2. Goals & Non-Goals

### Goals
- One-click install via `openclaw skills install soul-keeper` (and equivalent for Claude Code).
- Continuous encrypted backup of an agent's local memory files to FOC, addressed by PieceCID.
- Cross-session and cross-device restore: same password recovers the full soul on a fresh install.
- Synthesize `SOUL.md` from accumulated history via the running agent itself.
- Zero crypto-onboarding friction: user enters one password and everything else (wallet, gas, USDFC, CID) is invisible.
- Same skill body works on both Claude Code and OpenClaw runtimes.

### Non-Goals (for this POC)
- Filecoin mainnet support (Calibration testnet only).
- Selective restore UI (full restore with y/n confirm is enough).
- Multi-recipient sharing of an encrypted soul.
- BYOK (Bring Your Own Key) mode beyond a stub — POC ships sponsored mode only.
- Daily cron via OS scheduler — `SessionStart` check ("more than 24h since last backup?") is enough.
- Production-grade sponsor key custody — POC ships a throwaway embedded calibnet key; migration to a sponsor service is post-POC work.

## 3. Audience & Demo Target

Primary audience: AI builders at **Mu** event. Internal breakdown:
- ~40% crypto-native (have wallets, comfortable with USDFC).
- ~60% non-crypto-native (jennijuju's identified gap — the priority audience).

Demo target: Live show on author's laptop, ~8 minutes, three story beats:
1. One-click install + auto-backup on compact (Claude Code).
2. Same skill, same memory, on OpenClaw — proving runtime portability.
3. `/soul evolve` — agent synthesizes a new SOUL.md from history in real time.

## 4. Functional Scope

Three user-facing capabilities, in priority order:

| # | Capability | Trigger | What user sees |
|---|---|---|---|
| 1 | **Backup** (snapshot) | Automatic on `PreCompact` / `before_compaction`; manual `/soul backup` | Instant local-encrypted save; CID populates asynchronously in `/soul list` 1–2 min later |
| 2 | **Restore** | New `SessionStart` prompt; manual `/soul restore` | "Found prior snapshot — restore? (y/n)"; on yes, memory files reappear |
| 3 | **Evolve** | Manual `/soul evolve` | Current agent reads recent decrypted snapshots and writes a new `SOUL.md` |

## 5. Runtime Targets

Two runtimes, one skill body:

| Aspect | Claude Code | OpenClaw |
|---|---|---|
| State dir | `~/.claude/` | `~/.openclaw/` |
| Hook config | `settings.json` | `openclaw.json` |
| Hook mechanism | shell subprocess (stdin/stdout/exit) | in-process `handler.ts` + `HOOK.md` |
| Pre-compact event | `PreCompact` | `before_compaction` (fixed in PR #16788) |
| Session-start event | `SessionStart` | `agent:bootstrap` (fires on agent startup; closest semantic match) |
| Skill discovery | `~/.claude/skills/<skill>/SKILL.md` | `~/.openclaw/skills/<skill>/SKILL.md` (and other layers) |
| Default backup sources | `~/.claude/projects/<encoded-cwd>/memory/` + `soul.md` + `*.jsonl` | `~/.openclaw/workspace/{MEMORY,SOUL,AGENTS,USER,DREAMS}.md` + `memory/` |

`SKILL.md` and `commands/*.md` are byte-identical across both. Only the hook entry points and the runtime adapter differ.

## 6. Identity & Payment Model

### Password → wallet derivation (transparent to user)

```
user password
    │
    │ PBKDF2(password + "soul-keeper-aes-v1",   600K iters, SHA-256)
    ↓
AES-256-GCM key   (used by foc-encryption for envelope encryption)

    │ PBKDF2(password + "soul-keeper-session-v1", 600K iters, SHA-256)
    ↓
EVM private key   (32 bytes; never leaves machine; treated as session key)
    ↓
EVM address       (becomes the user's on-chain identity)
```

User never sees the EVM key or address. Same password on any machine → same key, same address, same on-chain dataset.

### 0xDEMO paymaster + session key delegation

`synapse-sdk` exposes a built-in session-key mechanism (see `CLAUDE.md` §Session Keys and `packages/synapse-sdk/src/synapse.ts:71`):

```ts
const sessionKey = SessionKey.fromSecp256k1({
  chain: calibration,
  privateKey: userSessionPrivateKey,
  root: privateKeyToAccount(SPONSOR_KEY),   // 0xDEMO
})
const synapse = new Synapse({ client: rootClient, sessionClient: sessionKey.client })
```

Effect: the user's derived key signs all FOC operations (EIP-712 only), while 0xDEMO is the payer for both USDFC storage fees and the on-chain authorization tx.

### User wallet needs zero funds — source-confirmed

Audited paths in `packages/synapse-core/src/sp/`:

- `addPieces(client, options)` at `add-pieces.ts:120-143` — calls `signAddPieces` (pure EIP-712) and then POSTs to Curio's `/pdp/data-sets/{dataSetId}/pieces`. Curio submits the on-chain tx and returns the txHash.
- `addPiecesApiRequest` at `add-pieces.ts:50-83` — only HTTP POST, no `writeContract`.
- `schedulePieceDeletion` at `schedule-piece-deletion.ts:98` — same HTTP-mediated pattern.

The user's session key only signs EIP-712 messages. **No FIL gas is consumed by the user's address.** Curio submits all storage-related on-chain txs (recouped via the USDFC payment rail funded by 0xDEMO).

The only on-chain calls signed by 0xDEMO itself:
- `paymentsService.deposit(USDFC, amount)` — one-time setup.
- `paymentsService.approveOperator(userSessionAddress, limits)` — once per new user.

### Sponsor balance & blast radius

| Parameter | Value | Rationale |
|---|---|---|
| 0xDEMO USDFC balance | 50 USDFC (calibnet) | Far above realistic POC usage |
| 0xDEMO FIL balance | 5 tFIL (calibnet) | Covers ~5000 approveOperator txs at ~0.001 FIL each |
| Per-user `lockupAllowance` | 1 USDFC | Hard ceiling per user |
| Per-user `rateAllowance` | 0.1 USDFC / month | Hard ceiling per user |
| Total exposure if 0xDEMO key leaks | ≤ 50 USDFC (calibnet, value ≈ 0) | Acceptable for short-lived POC |

### POC sponsor key custody

For the 24h Mu demo, the 0xDEMO private key is **hardcoded in `lib/sponsor.mjs`** in the public repo. This is explicitly accepted as a POC compromise on the conditions:

1. Wallet is freshly generated, never reused for anything else.
2. Only Calibration testnet; mainnet code path refuses to load this key.
3. Balance capped; total damage if leaked is < 50 USDFC of testnet tokens.
4. Within 48h of demo end: revoke all operator approvals, drain remaining USDFC + FIL, retire key.

Post-POC migration (out of scope but architected for): replace embedded key with a call to a Cloudflare Worker sponsor service that holds the key in env vars. The change is ~20 lines in `lib/sponsor.mjs`; user-facing behavior is unchanged.

### Cross-device discovery

```
new machine + same password
    ↓ PBKDF2 (same inputs, same outputs)
same userSessionAddress
    ↓
warmStorage.getDataSetsForOwner(userSessionAddress)
    ↓
[dataSet IDs owned by this user]
    ↓
warmStorage.getPiecesInDataSet(dataSetId)
    ↓
[CID list]
    ↓
foc.download(cid) → decrypt with PBKDF2-derived AES key → restore
```

No external indexer. No CID memorization. The chain is the directory; the password is the key.

## 7. Architecture

### Repo layout (`D:\workspace\soul-keeper\`)

```
soul-keeper/
├── SKILL.md                        # Skill entry, same on both runtimes
├── plugin.json                     # clawhub.ai metadata
├── package.json                    # deps: @filoz/synapse-sdk, viem
├── pnpm-lock.yaml
├── README.md                       # Install + demo + Mu cleanup checklist
├── LICENSE                         # Apache-2.0 OR MIT
├── .gitignore                      # Excludes config.json, *.env, *.key
├── install.mjs                     # Post-install: detect runtime, register hooks
│
├── commands/                       # ★ Runtime-agnostic, byte-identical on both
│   ├── soul-setup.md               # /soul setup — first-time password prompt
│   ├── soul-backup.md              # /soul backup
│   ├── soul-restore.md             # /soul restore
│   ├── soul-list.md                # /soul list
│   └── soul-evolve.md              # /soul evolve — slash template, current session synthesizes
│
├── lib/                            # ★ Runtime-agnostic Node ESM
│   ├── runtime/
│   │   ├── index.mjs               # detectRuntime() → adapter
│   │   ├── claude-code.mjs         # CC paths, hook event names, settings.json writer
│   │   └── openclaw.mjs            # OpenClaw paths, openclaw.json writer
│   ├── bundle.mjs                  # tar.gz + manifest.json builder
│   ├── crypto.mjs                  # foc-encryption wrapper (AES-256-GCM via COSE)
│   ├── foc.mjs                     # synapse-sdk wrapper (upload/download/discover)
│   ├── sponsor.mjs                 # SPONSOR_KEY + SPONSOR_LIMITS constants
│   ├── wallet.mjs                  # PBKDF2 → AES key + EVM session key derivation
│   ├── index-store.mjs             # ~/.claude/soul-keeper/index.json CRUD
│   ├── config.mjs                  # local config.json read/write
│   └── uploader.mjs                # Detached background uploader (runtime-agnostic)
│
├── runtimes/                       # ★ Two thin adapter layers
│   ├── claude-code/
│   │   └── hooks/
│   │       ├── pre-compact.mjs     # Shell entry; calls lib/
│   │       └── session-start.mjs   # Shell entry
│   │
│   └── openclaw/
│       └── hooks/
│           ├── before-compaction/
│           │   ├── HOOK.md         # frontmatter: events: [before_compaction]
│           │   └── handler.ts      # in-process; imports same lib/
│           └── agent-bootstrap/
│               ├── HOOK.md         # frontmatter: events: [agent:bootstrap]
│               └── handler.ts
│
│   # Note: lib/uploader.mjs is the runtime-agnostic detached background
│   # uploader. Both runtime hooks spawn it via lib/uploader.mjs directly.
│
├── vendor/
│   └── foc-encryption/             # Vendored dist + LICENSE
│       ├── dist/index.js
│       ├── dist/index.d.ts
│       ├── LICENSE
│       └── README.md
│
└── test/
    ├── lib/                        # Unit tests for runtime-agnostic lib
    ├── claude-code/                # CC hook smoke tests
    ├── openclaw/                   # OpenClaw handler smoke tests
    └── e2e/                        # End-to-end against Calibration FOC
```

### Runtime adapter interface

```js
// lib/runtime/claude-code.mjs
export const ClaudeCodeRuntime = {
  name: 'claude-code',
  stateDir: () => join(homedir(), '.claude'),
  projectDir: (cwd) => join(homedir(), '.claude', 'projects', encodeProjectPath(cwd)),
  memoryDir: (cwd) => join(projectDir(cwd), 'memory'),
  transcriptPaths: (cwd) => glob(projectDir(cwd) + '/*.jsonl'),
  configPath: () => join(stateDir(), 'settings.json'),
  defaultBackupSources: (cwd) => [memoryDir(cwd), join(cwd, 'soul.md'), ...transcriptPaths(cwd)],
  registerHooks: (hookDefs) => { /* merge into settings.json hooks array */ },
  emitSystemReminder: (text) => process.stdout.write(text + '\n'),
}

// lib/runtime/openclaw.mjs
export const OpenClawRuntime = {
  name: 'openclaw',
  stateDir: () => join(homedir(), '.openclaw'),
  workspaceDir: () => join(stateDir(), 'workspace'),
  memoryDir: () => join(workspaceDir(), 'memory'),
  configPath: () => join(stateDir(), 'openclaw.json'),
  defaultBackupSources: () => [
    join(workspaceDir(), 'MEMORY.md'),
    join(workspaceDir(), 'SOUL.md'),
    join(workspaceDir(), 'AGENTS.md'),
    join(workspaceDir(), 'USER.md'),
    join(workspaceDir(), 'DREAMS.md'),
    join(workspaceDir(), 'memory'),
  ],
  registerHooks: (hookDefs) => { /* merge into openclaw.json hooks block */ },
  emitSystemReminder: (text) => { /* via handler.ts wrapper: event.messages.push(text) */ },
}

// lib/runtime/index.mjs
export function detectRuntime() {
  if (process.env.SOUL_KEEPER_RUNTIME) {
    return require(`./${process.env.SOUL_KEEPER_RUNTIME}.mjs`).default
  }
  if (existsSync(join(homedir(), '.openclaw'))) return OpenClawRuntime
  if (existsSync(join(homedir(), '.claude')))   return ClaudeCodeRuntime
  throw new Error('No supported runtime detected. Install Claude Code or OpenClaw first.')
}
```

`install.mjs` accepts `--runtime=claude-code|openclaw|both` to override detection.

## 8. Data Flows

### 8.1 Backup (PreCompact path)

```
Claude Code / OpenClaw       hook entry           lib/*                uploader.mjs            FOC
        │                       │                   │                       │                   │
        │ PreCompact event ────►│                   │                       │                   │
        │                       │ bundle.create() ─►│                       │                   │
        │                       │◄── tar.gz ────────│                       │                   │
        │                       │ crypto.encrypt() ►│                       │                   │
        │                       │◄── .enc bytes ────│                       │                   │
        │                       │ fs.writeFile(     │                       │                   │
        │                       │   pending/<id>.enc)                       │                   │
        │                       │ index.add({       │                       │                   │
        │                       │   id, status:     │                       │                   │
        │                       │   'pending'})     │                       │                   │
        │                       │ spawn detached ──────────────────────────►│                   │
        │◄── exit 0 (≤1s) ──────│                   │                       │                   │
        │  (compact continues, user feels nothing)                          │                   │
        │                                                                   │ foc.upload(enc) ─►│
        │                                                                   │  (1–2 min)        │
        │                                                                   │◄── pieceCid ──────│
        │                                                                   │ index.update({    │
        │                                                                   │   cid, status:    │
        │                                                                   │   'uploaded'})    │
```

Hook exits within 1 second. All FOC work happens in a detached child process. Hook failure never blocks the agent.

### 8.2 Restore (SessionStart path)

```
runtime              session-start.mjs            lib/*               user            soul-restore
    │                       │                       │                   │                  │
    │ SessionStart  ───────►│                       │                   │                  │
    │                       │ index.listRecent(7d) ►│                   │                  │
    │                       │◄── [snapshots] ───────│                   │                  │
    │                       │ if any:                                                       │
    │                       │   emitSystemReminder("Found snapshot. Restore? (y/n)")        │
    │                       │   on yes ────────────────────────────────────────────────────►│
    │                       │                                                              │ prefer local pending/
    │                       │                                                              │ else foc.download(cid)
    │                       │                                                              │ crypto.decrypt()
    │                       │                                                              │ bundle.extract → atomic:
    │                       │                                                              │   tmp/ → rename to target
    │                       │                                                              │ emit "Restored from <id>"
```

Atomicity: extract to a tmp dir first, then rename into the runtime's memory dir. Decryption failure (wrong password) is detected before any writes.

### 8.3 Evolve (/soul evolve)

`commands/soul-evolve.md` is a slash template — when invoked, its body is expanded with parameters and injected as a user message into the current session. The current agent reads, reasons, writes.

Template body (paraphrased):

```markdown
You are soul-keeper. Decrypt the last 5 snapshots via:
  node lib/foc.mjs decrypt-recent --n 5 --out <os.tmpdir()>/soul-keeper-evolve/

Read every file under the output directory. For each:
- Extract memory entries, decisions, recurring workflows, voice.

If the runtime is OpenClaw, also read the most recent 14 days of
~/.openclaw/workspace/memory/YYYY-MM-DD.md as additional input.

Synthesize an updated SOUL.md / soul.md capturing:
- Role, working style, recurring concerns
- Tools and patterns this agent reaches for
- Open threads and long-running projects
- Voice

Write to the runtime-appropriate path. Preserve [[name]] links to memory entries.
Then queue the new soul for the next backup:
  node lib/bundle.mjs snapshot-soul

Done — report what changed.
```

No background LLM call, no external API key, no extra cost. The current session does the synthesis on-screen, which is also the strongest demo moment.

## 9. State Model

### 9.1 Local state directory

```
<runtime.stateDir()>/soul-keeper/
├── config.json                     # password hash, sponsor mode, network — NEVER in git
├── index.json                      # snapshot index (schema below)
├── pending/                        # local encrypted bundles awaiting (or post) upload
│   ├── 2026-05-12T14-30-00-abc123.enc
│   └── ...
└── logs/
    └── uploader.log                # detached uploader's stderr/stdout
```

### 9.2 `index.json` schema

```json
{
  "version": 1,
  "snapshots": [
    {
      "id": "2026-05-12T14-30-00-abc123",
      "createdAt": "2026-05-12T14:30:00Z",
      "trigger": "pre-compact" | "manual" | "session-start" | "evolve",
      "scope": ["memory", "soul", "transcript"],
      "localPath": "pending/2026-05-12T14-30-00-abc123.enc",
      "sizeBytes": 123456,
      "sha256": "...",
      "status": "pending" | "uploading" | "uploaded" | "failed",
      "cid": "baga6ea4seaq..." ,
      "uploadedAt": "2026-05-12T14:32:10Z",
      "uploadAttempts": 1,
      "lastError": null
    }
  ]
}
```

### 9.3 Retention policy (POC)

- `uploaded` bundles: keep local `.enc` for 7 days, then delete from `pending/`. Index entry stays forever.
- `failed` bundles: keep indefinitely; user decides via `/soul list` warnings.
- No disk quota cap in POC.

## 10. Error Handling

| Failure point | User experience | System behavior |
|---|---|---|
| Hook: bundle build fails (FS error) | Compact / session continues normally | Log to `uploader.log`; no index entry added |
| Hook: encrypt fails (no password set) | One-time hint "Run /soul setup first" | Hook short-circuits; non-blocking |
| Uploader: network / FOC failure | Invisible (background) | Index status = `failed`; `/soul list` warns; exponential retry 10s/60s/5m, then await next SessionStart |
| Uploader: 0xDEMO sponsor depleted | Same as above; `/soul list` shows "sponsor exhausted" tag | Skill operator must refill or migrate users |
| SessionStart: index corrupted | No restore prompt; silent | Move `index.json` → `index.json.broken-<ts>`; create fresh empty index |
| Restore: wrong password | "Wrong password. Snapshot not restored." | AES-GCM auth failure caught early; no writes |
| Restore: local missing + FOC unreachable | "Snapshot <cid> unreachable; try again later." | Index unchanged; no partial writes |
| Restore: extract to tmp, rename fails | "Restore failed; memory untouched." | tmp cleaned; no partial state |

Atomic invariant: **failure never corrupts user's current `memory/` or `SOUL.md`**.

## 11. Testing Strategy

| Level | Tool | Coverage |
|---|---|---|
| Unit | Vitest | `lib/bundle`, `lib/crypto` (encrypt→decrypt round trip), `lib/index-store`, `lib/runtime/*` constants |
| Integration | Vitest + real FS | `install.mjs` correctly writes `settings.json` / `openclaw.json`; hook entries discoverable by runtime |
| E2E (Calibration) | mocha + real FOC | `/soul backup` → poll for CID → fresh dir → `/soul restore` → byte-identical recovery |
| Smoke | bash | `openclaw skills install` clone + install completes; manual `/soul backup` returns success on both runtimes |
| Demo dry-run | manual | Full 8-min demo script run end-to-end the day before Mu |

## 12. Demo Plan (Mu, ~8 minutes)

| Time | Beat | Action |
|---|---|---|
| 0:00–0:30 | Hook | "Your claw never forgets." Show existing `memory/` files. |
| 0:30–2:00 | Install | `openclaw skills install soul-keeper`; `/soul setup` with password `mu-demo-2026`; install confirms hook registration |
| 2:00–3:00 | Manual backup | `/soul backup`; show instant local-encrypted save + async uploader spawned |
| 3:00–4:30 | Auto-backup via compact | Trigger `/compact`; PreCompact fires <1s; compact completes; `/soul list` shows pending → uploading → uploaded |
| 4:30–5:30 | Cross-runtime | Switch terminal to OpenClaw; same SKILL.md picked up; `/soul list` shows the same snapshots discoverable on chain |
| 5:30–7:00 | Soul evolve | `/soul evolve`; current agent reads recent decrypted snapshots and writes a new `SOUL.md` on-screen |
| 7:00–8:00 | Close | Show repo + clawhub.ai link; roadmap (mainnet, sponsor service, multi-recipient) |

Risk mitigation:
- Pre-run a backup 5 min before stage time so a CID is already settled (in case live upload runs long).
- Verify Calibration faucet balances on 0xDEMO morning of.
- Have second terminal with OpenClaw already running.

## 13. Effort Estimate (24h)

| Module | Hours |
|---|---|
| `lib/` (bundle, crypto, foc, sponsor, wallet, index-store, config, runtime adapter) | 6 |
| `runtimes/claude-code/hooks/*.mjs` + settings.json wiring in install.mjs | 2 |
| `runtimes/openclaw/hooks/**/handler.ts` + `HOOK.md` + openclaw.json wiring | 3 |
| `commands/soul-*.md` (4 templates) | 1 |
| `install.mjs` runtime detection + first-run sponsor approval | 1 |
| Vendor `foc-encryption` dist + `package.json` + repo init | 1 |
| E2E smoke against Calibration | 3 |
| README + demo script dry-run | 2 |
| **Total** | **~19** (5h buffer in 24h window) |

## 14. Post-Demo Cleanup (Mandatory, within 48h)

1. Run `node scripts/revoke-all.mjs` — sets `lockupAllowance=0` for every operator approved by 0xDEMO.
2. Transfer remaining USDFC from FilecoinPay back to deployer's primary wallet.
3. Transfer remaining FIL out of 0xDEMO.
4. Remove `SPONSOR_KEY` from `lib/sponsor.mjs` (commit a follow-up that replaces it with the sponsor-service stub). Treat any historical git commits containing the key as permanently leaked — do not attempt history rewrites; revocation + draining (steps 1–3) is the real defense.
5. Tag the repo as `v0.1.0-mu-demo` for reference.

## 15. Out of Scope (Explicit)

- **Mainnet**: Code paths refuse to load `SPONSOR_KEY` if `chain !== calibration`.
- **Selective restore UI**: Full restore with y/n only.
- **Multi-recipient COSE_Encrypt** envelopes: single-recipient AES only.
- **Daily cron**: SessionStart check ("more than 24h since last backup") is sufficient.
- **BYOK mode**: stub interface in `lib/sponsor.mjs`; implementation post-POC.
- **Sponsor service (Cloudflare Worker)**: post-POC migration target.
- **Indexer**: explicitly not built — chain is the directory.
- **Web UI / dashboard**: CLI only.

## 16. References

- `synapse-sdk` — `D:\workspace\synapse-sdk\CLAUDE.md`; session key API at `packages/synapse-sdk/src/synapse.ts:71`; `addPieces` at `packages/synapse-core/src/sp/add-pieces.ts:120`.
- `foc-encryption` — `D:\workspace\foc-encryption-demo\`; vendor the `packages/foc-encryption/dist/` output.
- OpenClaw skills/hooks — https://docs.openclaw.ai/tools/skills, https://docs.openclaw.ai/automation/hooks.
- OpenClaw compaction hooks fix — https://github.com/openclaw/openclaw/issues/9527 (closed via PR #16788).
- ClawHub registry — https://clawhub.ai/.
- Filecoin PieceCID — FRC-0069.
- Calibration RPC — `https://api.calibration.node.glif.io/rpc/v1`.
