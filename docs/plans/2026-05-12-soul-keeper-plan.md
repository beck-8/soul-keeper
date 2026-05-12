# Soul Keeper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a one-click Claude Code / OpenClaw skill that backs up an agent's memory + SOUL.md to Filecoin Onchain Cloud (FOC) with client-side encryption, supports cross-device restore via password-only UX, and synthesizes SOUL.md from history via the running agent.

**Architecture:** Single self-contained skill folder. Runtime-agnostic Node ESM core (`lib/`) + thin runtime adapters (`runtimes/claude-code/`, `runtimes/openclaw/`) that share the same `commands/` slash templates and `SKILL.md`. Identity = password → PBKDF2 → AES-256-GCM key + EVM session key. 0xDEMO embedded calibnet wallet is paymaster via synapse-sdk session keys; user wallet holds zero funds. Async upload via detached child process so PreCompact hooks return in < 1s.

**Tech Stack:** Node 20+, TypeScript 5.9+ (handlers only), Node ESM, viem, `@filoz/synapse-sdk`, vendored `foc-encryption`, Vitest, biome.

---

## File Structure

Files this plan creates, grouped by responsibility:

**Bootstrap & config:**
- `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `biome.json`, `vitest.config.mjs`
- `.gitignore`, `.npmrc`, `LICENSE`

**Top-level skill metadata:**
- `SKILL.md`, `plugin.json`, `README.md`

**Vendored dependencies:**
- `vendor/foc-encryption/{dist,LICENSE,README.md}`

**Runtime-agnostic core (`lib/`):**
- `lib/wallet.mjs` — PBKDF2 → AES key + EVM private key derivation
- `lib/crypto.mjs` — wraps foc-encryption (encrypt/decrypt of bundles)
- `lib/bundle.mjs` — tar.gz + manifest builder/extractor
- `lib/config.mjs` — `~/<runtime>/soul-keeper/config.json` CRUD
- `lib/index-store.mjs` — `index.json` CRUD
- `lib/sponsor.mjs` — `SPONSOR_KEY`, `SPONSOR_LIMITS`, environment guards
- `lib/runtime/index.mjs` — `detectRuntime()`
- `lib/runtime/claude-code.mjs` — CC paths, hooks writer
- `lib/runtime/openclaw.mjs` — OpenClaw paths, hooks writer
- `lib/foc.mjs` — synapse-sdk wrapper (upload/download/discover via session key)
- `lib/uploader.mjs` — detached background uploader CLI entry

**Slash command templates (`commands/`):**
- `commands/soul-setup.md`, `soul-backup.md`, `soul-restore.md`, `soul-list.md`, `soul-evolve.md`

**Runtime adapter entry points (`runtimes/`):**
- `runtimes/claude-code/hooks/pre-compact.mjs`
- `runtimes/claude-code/hooks/session-start.mjs`
- `runtimes/openclaw/hooks/before-compaction/{HOOK.md,handler.ts}`
- `runtimes/openclaw/hooks/agent-bootstrap/{HOOK.md,handler.ts}`

**Install/teardown scripts:**
- `install.mjs`, `scripts/revoke-all.mjs`, `scripts/gen-wallet.mjs`, `scripts/setup-sponsor.mjs`

**Tests:**
- `test/lib/*.test.mjs` for each lib module
- `test/runtime/*.test.mjs` for runtime adapters
- `test/e2e/calibration.test.mjs` for E2E smoke

---

## Conventions

- All source files use Node ESM (`.mjs`), except the OpenClaw `handler.ts` which TypeScript-compiles to `.js` (OpenClaw expects TS).
- Filenames are kebab-case (e.g., `soul-keeper.mjs`).
- No `!` non-null operator; use `?.` or explicit checks.
- No trailing semicolons (biome's `asNeeded`).
- Imports use `.mjs` extensions explicitly.
- Run `pnpm run lint:fix` after each task.
- Commit after every task with conventional commit message.

---

## Task 1: Repo bootstrap

**Files:**
- Create: `D:\workspace\soul-keeper\package.json`
- Create: `D:\workspace\soul-keeper\tsconfig.json`
- Create: `D:\workspace\soul-keeper\biome.json`
- Create: `D:\workspace\soul-keeper\vitest.config.mjs`
- Create: `D:\workspace\soul-keeper\.gitignore`
- Create: `D:\workspace\soul-keeper\.npmrc`
- Create: `D:\workspace\soul-keeper\LICENSE`

- [ ] **Step 1: Initialize git**

```bash
cd D:/workspace/soul-keeper
git init
```

Expected: `Initialized empty Git repository in D:/workspace/soul-keeper/.git/`

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "soul-keeper",
  "version": "0.1.0-mu-demo",
  "type": "module",
  "description": "Encrypt, persist, and self-evolve your agent's soul on Filecoin Onchain Cloud",
  "license": "(Apache-2.0 OR MIT)",
  "engines": { "node": ">=20" },
  "packageManager": "pnpm@10.7.0",
  "scripts": {
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "vitest run test/e2e"
  },
  "dependencies": {
    "@filoz/synapse-sdk": "^0.41.0",
    "viem": "^2.0.0",
    "tar-stream": "^3.1.7"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.0",
    "@types/node": "^20.0.0",
    "typescript": "^5.9.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 3: Create `tsconfig.json`** (used only by OpenClaw handler.ts compilation)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./runtimes/openclaw/hooks",
    "rootDir": "./runtimes/openclaw/hooks",
    "declaration": false,
    "allowImportingTsExtensions": false
  },
  "include": ["runtimes/openclaw/hooks/**/*.ts"]
}
```

- [ ] **Step 4: Create `biome.json`**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "semicolons": "asNeeded",
      "quoteStyle": "single",
      "trailingCommas": "all"
    }
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "style": { "noNonNullAssertion": "error" }
    }
  },
  "files": {
    "ignore": ["dist", "vendor", "node_modules", ".pending"]
  }
}
```

- [ ] **Step 5: Create `vitest.config.mjs`**

```js
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.mjs'],
    exclude: ['test/e2e/**', 'node_modules/**'],
    testTimeout: 30_000,
    environment: 'node',
  },
})
```

- [ ] **Step 6: Create `.gitignore`**

```gitignore
node_modules/
dist/
.pending/

# Local-only configuration with secrets
config.json
*.env
*.env.demo
*.key

# OS / editor
.DS_Store
Thumbs.db
.vscode/
.idea/
```

- [ ] **Step 7: Create `.npmrc`**

```
auto-install-peers=true
strict-peer-dependencies=false
```

- [ ] **Step 8: Create `LICENSE`** (Apache-2.0 + MIT dual; copy from synapse-sdk root LICENSE format)

Use the dual-license file as in `D:/workspace/synapse-sdk/LICENSE-APACHE` + `LICENSE-MIT`. For brevity, copy one Apache-2.0 + one MIT into `LICENSE` separated by `---`.

- [ ] **Step 9: Install dependencies**

```bash
cd D:/workspace/soul-keeper && pnpm install
```

Expected: dependencies install; `pnpm-lock.yaml` is created.

- [ ] **Step 10: Verify scripts work**

```bash
pnpm run lint
pnpm run test
```

Expected: lint passes on empty repo (no files yet); vitest exits with "no test files found" — both OK.

- [ ] **Step 11: Initial commit**

```bash
cd D:/workspace/soul-keeper
git add -A
git commit -m "chore: repo bootstrap (package.json, biome, vitest, license)"
```

---

## Task 2: Vendor foc-encryption

**Files:**
- Create: `vendor/foc-encryption/dist/*`
- Create: `vendor/foc-encryption/LICENSE`
- Create: `vendor/foc-encryption/README.md` (short pointer)
- Create: `vendor/foc-encryption/package.json` (minimal manifest)

- [ ] **Step 1: Build foc-encryption in its workspace**

```bash
cd D:/workspace/foc-encryption-demo
pnpm install
pnpm -F foc-encryption build
ls packages/foc-encryption/dist
```

Expected: `dist/` contains `index.js` and `index.d.ts`.

- [ ] **Step 2: Copy dist + license to vendor**

```bash
mkdir -p D:/workspace/soul-keeper/vendor/foc-encryption/dist
cp D:/workspace/foc-encryption-demo/packages/foc-encryption/dist/* D:/workspace/soul-keeper/vendor/foc-encryption/dist/
cp D:/workspace/foc-encryption-demo/LICENSE D:/workspace/soul-keeper/vendor/foc-encryption/LICENSE 2>/dev/null || cp D:/workspace/foc-encryption-demo/packages/foc-encryption/LICENSE D:/workspace/soul-keeper/vendor/foc-encryption/LICENSE
```

- [ ] **Step 3: Create minimal `vendor/foc-encryption/package.json`**

```json
{
  "name": "vendored-foc-encryption",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "license": "(Apache-2.0 OR MIT)",
  "description": "Vendored copy of foc-encryption from D:/workspace/foc-encryption-demo; resync when upstream changes."
}
```

- [ ] **Step 4: Create `vendor/foc-encryption/README.md`**

```markdown
# Vendored foc-encryption

This is a pinned copy of `foc-encryption` from `D:/workspace/foc-encryption-demo/packages/foc-encryption/`. To resync:

1. `cd ../../../foc-encryption-demo && pnpm -F foc-encryption build`
2. `cp packages/foc-encryption/dist/* ../soul-keeper/vendor/foc-encryption/dist/`
3. Commit.

Removed when `foc-encryption` is published to npm; will be replaced by a regular dependency.
```

- [ ] **Step 5: Add path alias to `package.json`**

Modify `D:/workspace/soul-keeper/package.json` — add the `imports` block:

```json
{
  "imports": {
    "#foc-encryption": "./vendor/foc-encryption/dist/index.js"
  }
}
```

(Library code does `import { ... } from '#foc-encryption'`.)

- [ ] **Step 6: Smoke test the import**

Create `test/smoke/vendor.test.mjs`:

```js
import { describe, it, expect } from 'vitest'

describe('vendored foc-encryption', () => {
  it('imports without throwing', async () => {
    const mod = await import('#foc-encryption')
    expect(mod).toBeDefined()
    expect(Object.keys(mod).length).toBeGreaterThan(0)
  })
})
```

Run: `pnpm test test/smoke/vendor.test.mjs`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add vendor/ package.json test/smoke/vendor.test.mjs
git commit -m "feat: vendor foc-encryption dist for self-contained skill"
```

---

## Task 3: `lib/wallet.mjs` — password → AES key + EVM key

**Files:**
- Create: `lib/wallet.mjs`
- Test: `test/lib/wallet.test.mjs`

Password derives two independent secrets via PBKDF2 with different salts so compromise of one doesn't expose the other.

- [ ] **Step 1: Write failing tests**

Create `test/lib/wallet.test.mjs`:

```js
import { describe, it, expect } from 'vitest'
import { deriveAesKey, deriveSessionKey, deriveAll } from '../../lib/wallet.mjs'

describe('lib/wallet', () => {
  it('deriveAesKey is deterministic', async () => {
    const a = await deriveAesKey('hunter2')
    const b = await deriveAesKey('hunter2')
    expect(a).toEqual(b)
    expect(a.byteLength).toBe(32)
  })

  it('different passwords produce different AES keys', async () => {
    const a = await deriveAesKey('alpha')
    const b = await deriveAesKey('beta')
    expect(a).not.toEqual(b)
  })

  it('deriveSessionKey returns 32-byte hex EVM private key', async () => {
    const sk = await deriveSessionKey('hunter2')
    expect(sk).toMatch(/^0x[0-9a-f]{64}$/)
  })

  it('AES key and session key for same password are different', async () => {
    const aes = await deriveAesKey('hunter2')
    const sk = await deriveSessionKey('hunter2')
    const aesHex = '0x' + Buffer.from(aes).toString('hex')
    expect(aesHex).not.toBe(sk)
  })

  it('deriveAll returns AES key, session private key, and EVM address', async () => {
    const all = await deriveAll('hunter2')
    expect(all.aesKey.byteLength).toBe(32)
    expect(all.sessionPrivateKey).toMatch(/^0x[0-9a-f]{64}$/)
    expect(all.sessionAddress).toMatch(/^0x[0-9a-fA-F]{40}$/)
  })

  it('deriveAll on same password produces same EVM address', async () => {
    const a = await deriveAll('hunter2')
    const b = await deriveAll('hunter2')
    expect(a.sessionAddress).toBe(b.sessionAddress)
  })
})
```

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm test test/lib/wallet.test.mjs`
Expected: FAIL ("Cannot find module ../../lib/wallet.mjs")

- [ ] **Step 3: Implement `lib/wallet.mjs`**

```js
import { webcrypto } from 'node:crypto'
import { privateKeyToAccount } from 'viem/accounts'

const PBKDF2_ITERS = 600_000
const SALT_AES = 'soul-keeper-aes-v1'
const SALT_SESSION = 'soul-keeper-session-v1'

async function pbkdf2(password, saltStr, lengthBytes) {
  const encoder = new TextEncoder()
  const baseKey = await webcrypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  )
  const bits = await webcrypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(saltStr),
      iterations: PBKDF2_ITERS,
      hash: 'SHA-256',
    },
    baseKey,
    lengthBytes * 8,
  )
  return new Uint8Array(bits)
}

export async function deriveAesKey(password) {
  return await pbkdf2(password, SALT_AES, 32)
}

export async function deriveSessionKey(password) {
  const bytes = await pbkdf2(password, SALT_SESSION, 32)
  return '0x' + Buffer.from(bytes).toString('hex')
}

export async function deriveAll(password) {
  const aesKey = await deriveAesKey(password)
  const sessionPrivateKey = await deriveSessionKey(password)
  const account = privateKeyToAccount(sessionPrivateKey)
  return {
    aesKey,
    sessionPrivateKey,
    sessionAddress: account.address,
  }
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `pnpm test test/lib/wallet.test.mjs`
Expected: 6 passing

- [ ] **Step 5: Lint + commit**

```bash
pnpm run lint:fix
git add lib/wallet.mjs test/lib/wallet.test.mjs
git commit -m "feat(lib): wallet derivation (AES key + EVM session key from password)"
```

---

## Task 4: `lib/crypto.mjs` — encrypt/decrypt with foc-encryption

**Files:**
- Create: `lib/crypto.mjs`
- Test: `test/lib/crypto.test.mjs`

Wraps foc-encryption's COSE envelope API. Inputs: bundle bytes + password. Outputs: encrypted bytes + COSE envelope metadata.

- [ ] **Step 1: Inspect vendored foc-encryption API**

Open `D:/workspace/foc-encryption/dist/index.d.ts` (or the vendor path) and find the exported encrypt/decrypt functions. Typical names: `encryptWithPassword`, `decryptWithPassword`. **If names differ in the actual vendored output, adjust references in steps below to match.**

- [ ] **Step 2: Write failing tests**

Create `test/lib/crypto.test.mjs`:

```js
import { describe, it, expect } from 'vitest'
import { encryptBundle, decryptBundle } from '../../lib/crypto.mjs'

describe('lib/crypto', () => {
  it('encrypts then decrypts to identical bytes', async () => {
    const plaintext = new TextEncoder().encode('hello soul world')
    const ciphertext = await encryptBundle(plaintext, 'pw123')
    expect(ciphertext.length).toBeGreaterThan(plaintext.length)
    const decrypted = await decryptBundle(ciphertext, 'pw123')
    expect(new TextDecoder().decode(decrypted)).toBe('hello soul world')
  })

  it('wrong password throws auth failure', async () => {
    const plaintext = new TextEncoder().encode('secret stuff')
    const ciphertext = await encryptBundle(plaintext, 'right-pw')
    await expect(decryptBundle(ciphertext, 'wrong-pw')).rejects.toThrow()
  })

  it('handles empty bundle', async () => {
    const ciphertext = await encryptBundle(new Uint8Array(0), 'pw')
    const decrypted = await decryptBundle(ciphertext, 'pw')
    expect(decrypted.byteLength).toBe(0)
  })

  it('handles large bundle (>256 KiB triggers chunked path)', async () => {
    const big = new Uint8Array(300 * 1024)
    for (let i = 0; i < big.length; i++) big[i] = i & 0xff
    const ciphertext = await encryptBundle(big, 'pw')
    const decrypted = await decryptBundle(ciphertext, 'pw')
    expect(decrypted).toEqual(big)
  })
})
```

- [ ] **Step 3: Run tests, verify failure**

Run: `pnpm test test/lib/crypto.test.mjs`
Expected: FAIL ("Cannot find module")

- [ ] **Step 4: Implement `lib/crypto.mjs`**

```js
import { encryptWithPassword, decryptWithPassword } from '#foc-encryption'

export async function encryptBundle(plaintext, password) {
  return await encryptWithPassword(plaintext, password)
}

export async function decryptBundle(ciphertext, password) {
  return await decryptWithPassword(ciphertext, password)
}
```

**Note:** if foc-encryption exports different names (e.g., `encryptBlob` / `decryptBlob`), update the imports to match what `dist/index.d.ts` actually exposes. See foc-encryption README.

- [ ] **Step 5: Run tests, verify pass**

Run: `pnpm test test/lib/crypto.test.mjs`
Expected: 4 passing

- [ ] **Step 6: Commit**

```bash
pnpm run lint:fix
git add lib/crypto.mjs test/lib/crypto.test.mjs
git commit -m "feat(lib): crypto wrapper around foc-encryption (AES-256-GCM COSE)"
```

---

## Task 5: `lib/bundle.mjs` — tar.gz bundle build/extract

**Files:**
- Create: `lib/bundle.mjs`
- Test: `test/lib/bundle.test.mjs`

A bundle is a tar.gz containing the files plus a `manifest.json` describing what's inside.

- [ ] **Step 1: Write failing tests**

Create `test/lib/bundle.test.mjs`:

```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createBundle, extractBundle } from '../../lib/bundle.mjs'

let workDir
beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'soul-bundle-'))
})
afterEach(() => {
  rmSync(workDir, { recursive: true, force: true })
})

describe('lib/bundle', () => {
  it('creates a bundle from files', async () => {
    const src = join(workDir, 'src')
    mkdirSync(src)
    writeFileSync(join(src, 'a.md'), 'hello')
    writeFileSync(join(src, 'b.md'), 'world')

    const { bytes, manifest } = await createBundle({
      sources: [join(src, 'a.md'), join(src, 'b.md')],
      baseDir: src,
    })

    expect(bytes.length).toBeGreaterThan(0)
    expect(manifest.files).toHaveLength(2)
    expect(manifest.files.map((f) => f.path).sort()).toEqual(['a.md', 'b.md'])
    expect(manifest.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('extracts a bundle losslessly', async () => {
    const src = join(workDir, 'src')
    mkdirSync(src)
    writeFileSync(join(src, 'memory.md'), 'persistent memory')

    const { bytes } = await createBundle({
      sources: [join(src, 'memory.md')],
      baseDir: src,
    })

    const out = join(workDir, 'out')
    mkdirSync(out)
    await extractBundle(bytes, out)
    expect(readFileSync(join(out, 'memory.md'), 'utf8')).toBe('persistent memory')
  })

  it('skips missing source files silently', async () => {
    const src = join(workDir, 'src')
    mkdirSync(src)
    writeFileSync(join(src, 'a.md'), 'present')

    const { manifest } = await createBundle({
      sources: [join(src, 'a.md'), join(src, 'missing.md')],
      baseDir: src,
    })
    expect(manifest.files).toHaveLength(1)
    expect(manifest.skipped).toContain(join(src, 'missing.md'))
  })

  it('handles directory sources by including all files', async () => {
    const src = join(workDir, 'src')
    mkdirSync(src)
    mkdirSync(join(src, 'memory'))
    writeFileSync(join(src, 'memory', 'one.md'), 'a')
    writeFileSync(join(src, 'memory', 'two.md'), 'b')

    const { manifest } = await createBundle({
      sources: [join(src, 'memory')],
      baseDir: src,
    })
    expect(manifest.files.map((f) => f.path).sort()).toEqual([
      'memory/one.md',
      'memory/two.md',
    ])
  })
})
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm test test/lib/bundle.test.mjs`
Expected: FAIL

- [ ] **Step 3: Implement `lib/bundle.mjs`**

```js
import { readFileSync, statSync, existsSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { createGzip, createGunzip } from 'node:zlib'
import { Readable } from 'node:stream'
import tar from 'tar-stream'

function collectFiles(sources, baseDir) {
  const files = []
  const skipped = []
  for (const src of sources) {
    if (!existsSync(src)) {
      skipped.push(src)
      continue
    }
    const stat = statSync(src)
    if (stat.isDirectory()) {
      walkDir(src, files, baseDir)
    } else {
      files.push({ absPath: src, relPath: relative(baseDir, src), size: stat.size })
    }
  }
  return { files, skipped }
}

function walkDir(dir, out, baseDir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walkDir(full, out, baseDir)
    else out.push({ absPath: full, relPath: relative(baseDir, full).replaceAll('\\', '/'), size: statSync(full).size })
  }
}

export async function createBundle({ sources, baseDir, scope }) {
  const { files, skipped } = collectFiles(sources, baseDir)
  const manifest = {
    version: 1,
    createdAt: new Date().toISOString(),
    scope: scope ?? [],
    files: files.map((f) => ({ path: f.relPath, size: f.size })),
    skipped,
  }

  const pack = tar.pack()
  pack.entry({ name: 'manifest.json' }, JSON.stringify(manifest, null, 2))
  for (const f of files) {
    pack.entry({ name: f.relPath }, readFileSync(f.absPath))
  }
  pack.finalize()

  const gzipped = await streamToBuffer(pack.pipe(createGzip()))
  return { bytes: gzipped, manifest }
}

export async function extractBundle(bytes, outDir) {
  const extract = tar.extract()
  const writes = []
  extract.on('entry', (header, stream, next) => {
    if (header.name === 'manifest.json') {
      stream.resume()
      stream.on('end', next)
      return
    }
    const dest = join(outDir, header.name)
    mkdirSync(dirname(dest), { recursive: true })
    const chunks = []
    stream.on('data', (c) => chunks.push(c))
    stream.on('end', () => {
      writeFileSync(dest, Buffer.concat(chunks))
      next()
    })
  })

  Readable.from(bytes).pipe(createGunzip()).pipe(extract)
  await new Promise((resolve, reject) => {
    extract.on('finish', resolve)
    extract.on('error', reject)
  })
}

function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = []
    stream.on('data', (c) => chunks.push(c))
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', reject)
  })
}
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm test test/lib/bundle.test.mjs`
Expected: 4 passing

- [ ] **Step 5: Commit**

```bash
pnpm run lint:fix
git add lib/bundle.mjs test/lib/bundle.test.mjs
git commit -m "feat(lib): bundle build/extract (tar.gz + manifest)"
```

---

## Task 6: `lib/config.mjs` — local config read/write

**Files:**
- Create: `lib/config.mjs`
- Test: `test/lib/config.test.mjs`

Config lives at `<runtime-state-dir>/soul-keeper/config.json`. For test isolation accept an override path.

- [ ] **Step 1: Write failing tests**

Create `test/lib/config.test.mjs`:

```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadConfig, saveConfig, hasPassword } from '../../lib/config.mjs'

let tmp
beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), 'sk-cfg-')) })
afterEach(() => { rmSync(tmp, { recursive: true, force: true }) })

describe('lib/config', () => {
  it('loadConfig returns empty defaults when no file exists', async () => {
    const cfg = await loadConfig({ stateDir: tmp })
    expect(cfg.passwordHash).toBeUndefined()
    expect(cfg.network).toBe('calibration')
  })

  it('saveConfig persists and loadConfig retrieves', async () => {
    await saveConfig({ stateDir: tmp }, { passwordHash: 'abc', network: 'calibration' })
    const cfg = await loadConfig({ stateDir: tmp })
    expect(cfg.passwordHash).toBe('abc')
  })

  it('hasPassword reflects whether passwordHash is set', async () => {
    expect(await hasPassword({ stateDir: tmp })).toBe(false)
    await saveConfig({ stateDir: tmp }, { passwordHash: 'x' })
    expect(await hasPassword({ stateDir: tmp })).toBe(true)
  })
})
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm test test/lib/config.test.mjs`
Expected: FAIL

- [ ] **Step 3: Implement `lib/config.mjs`**

```js
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

function configPath({ stateDir }) {
  return join(stateDir, 'soul-keeper', 'config.json')
}

const DEFAULTS = {
  version: 1,
  network: 'calibration',
  passwordHash: undefined,
  useUserKey: false,
  userPrivateKey: undefined,
  handle: undefined,
}

export async function loadConfig({ stateDir }) {
  try {
    const raw = await readFile(configPath({ stateDir }), 'utf8')
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch (err) {
    if (err.code === 'ENOENT') return { ...DEFAULTS }
    throw err
  }
}

export async function saveConfig({ stateDir }, patch) {
  const current = await loadConfig({ stateDir })
  const next = { ...current, ...patch }
  await mkdir(join(stateDir, 'soul-keeper'), { recursive: true })
  await writeFile(configPath({ stateDir }), JSON.stringify(next, null, 2))
  return next
}

export async function hasPassword({ stateDir }) {
  const cfg = await loadConfig({ stateDir })
  return Boolean(cfg.passwordHash)
}
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm test test/lib/config.test.mjs`
Expected: 3 passing

- [ ] **Step 5: Commit**

```bash
pnpm run lint:fix
git add lib/config.mjs test/lib/config.test.mjs
git commit -m "feat(lib): config read/write with stateDir injection for tests"
```

---

## Task 7: `lib/index-store.mjs` — snapshot index CRUD

**Files:**
- Create: `lib/index-store.mjs`
- Test: `test/lib/index-store.test.mjs`

- [ ] **Step 1: Write failing tests**

Create `test/lib/index-store.test.mjs`:

```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  addSnapshot,
  updateSnapshot,
  listSnapshots,
  getSnapshot,
} from '../../lib/index-store.mjs'

let tmp
beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), 'sk-idx-')) })
afterEach(() => { rmSync(tmp, { recursive: true, force: true }) })

describe('lib/index-store', () => {
  it('addSnapshot persists and listSnapshots retrieves', async () => {
    await addSnapshot({ stateDir: tmp }, {
      id: 's1', createdAt: '2026-05-12T00:00:00Z', trigger: 'manual',
      scope: ['memory'], localPath: 'pending/s1.enc', sizeBytes: 100,
      sha256: 'aa', status: 'pending',
    })
    const all = await listSnapshots({ stateDir: tmp })
    expect(all).toHaveLength(1)
    expect(all[0].id).toBe('s1')
  })

  it('updateSnapshot merges patch fields', async () => {
    await addSnapshot({ stateDir: tmp }, {
      id: 's1', createdAt: 'x', trigger: 'manual', scope: [],
      localPath: 'p', sizeBytes: 0, sha256: '', status: 'pending',
    })
    await updateSnapshot({ stateDir: tmp }, 's1', { status: 'uploaded', cid: 'baga...' })
    const snap = await getSnapshot({ stateDir: tmp }, 's1')
    expect(snap.status).toBe('uploaded')
    expect(snap.cid).toBe('baga...')
  })

  it('listSnapshots returns empty array when index missing', async () => {
    expect(await listSnapshots({ stateDir: tmp })).toEqual([])
  })

  it('getSnapshot returns undefined for unknown id', async () => {
    expect(await getSnapshot({ stateDir: tmp }, 'missing')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run, verify fail**

- [ ] **Step 3: Implement `lib/index-store.mjs`**

```js
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises'
import { join } from 'node:path'

function indexPath({ stateDir }) {
  return join(stateDir, 'soul-keeper', 'index.json')
}

async function read({ stateDir }) {
  try {
    const raw = await readFile(indexPath({ stateDir }), 'utf8')
    return JSON.parse(raw)
  } catch (err) {
    if (err.code === 'ENOENT') return { version: 1, snapshots: [] }
    if (err instanceof SyntaxError) {
      const backup = indexPath({ stateDir }) + `.broken-${Date.now()}`
      await rename(indexPath({ stateDir }), backup)
      return { version: 1, snapshots: [] }
    }
    throw err
  }
}

async function write({ stateDir }, data) {
  await mkdir(join(stateDir, 'soul-keeper'), { recursive: true })
  await writeFile(indexPath({ stateDir }), JSON.stringify(data, null, 2))
}

export async function addSnapshot(ctx, snap) {
  const idx = await read(ctx)
  idx.snapshots.push(snap)
  await write(ctx, idx)
}

export async function updateSnapshot(ctx, id, patch) {
  const idx = await read(ctx)
  const i = idx.snapshots.findIndex((s) => s.id === id)
  if (i === -1) throw new Error(`Snapshot ${id} not found`)
  idx.snapshots[i] = { ...idx.snapshots[i], ...patch }
  await write(ctx, idx)
}

export async function listSnapshots(ctx) {
  const idx = await read(ctx)
  return idx.snapshots
}

export async function getSnapshot(ctx, id) {
  const all = await listSnapshots(ctx)
  return all.find((s) => s.id === id)
}
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm test test/lib/index-store.test.mjs`
Expected: 4 passing

- [ ] **Step 5: Commit**

```bash
pnpm run lint:fix
git add lib/index-store.mjs test/lib/index-store.test.mjs
git commit -m "feat(lib): index-store CRUD with auto-recovery from corrupt index.json"
```

---

## Task 8: `lib/sponsor.mjs` — paymaster constants + guards

**Files:**
- Create: `lib/sponsor.mjs`
- Test: `test/lib/sponsor.test.mjs`

The user will add the actual SPONSOR_KEY value later. The module exposes:
- `SPONSOR_KEY` constant (empty string until populated)
- `SPONSOR_LIMITS` operator-approval limits
- `getSponsor()` returns key + chain guard; throws if user sets `network=mainnet`
- `hasSponsorKey()` for fallback detection

- [ ] **Step 1: Write failing tests**

Create `test/lib/sponsor.test.mjs`:

```js
import { describe, it, expect, vi } from 'vitest'

describe('lib/sponsor', () => {
  it('hasSponsorKey returns false when key is empty', async () => {
    vi.resetModules()
    const mod = await import('../../lib/sponsor.mjs')
    expect(mod.hasSponsorKey()).toBe(false)
  })

  it('SPONSOR_LIMITS exposes rate and lockup allowances', async () => {
    const { SPONSOR_LIMITS } = await import('../../lib/sponsor.mjs')
    expect(typeof SPONSOR_LIMITS.rateAllowance).toBe('bigint')
    expect(typeof SPONSOR_LIMITS.lockupAllowance).toBe('bigint')
    expect(SPONSOR_LIMITS.lockupAllowance).toBeGreaterThan(0n)
  })

  it('getSponsor throws if network is mainnet', async () => {
    const { getSponsor } = await import('../../lib/sponsor.mjs')
    expect(() => getSponsor({ network: 'mainnet' })).toThrow(/calibration/i)
  })

  it('getSponsor returns key info on calibration', async () => {
    const { getSponsor } = await import('../../lib/sponsor.mjs')
    const s = getSponsor({ network: 'calibration' })
    expect(s.network).toBe('calibration')
    expect(s.rpcUrl).toMatch(/calibration/)
  })
})
```

- [ ] **Step 2: Run, verify fail**

- [ ] **Step 3: Implement `lib/sponsor.mjs`**

```js
// 0xDEMO sponsor — populated by `scripts/setup-sponsor.mjs` before demo.
// Leave empty in repo; runtime fallback prompts user to BYOK or contact author.
export const SPONSOR_KEY = ''
export const SPONSOR_ADDRESS = ''

// USDFC has 18 decimals
const USDFC = (n) => BigInt(Math.floor(n * 1e6)) * 10n ** 12n

export const SPONSOR_LIMITS = {
  rateAllowance: USDFC(0.1),    // 0.1 USDFC per month per user
  lockupAllowance: USDFC(1.0),  // 1 USDFC total lockup per user
}

const CALIBRATION_RPC = 'https://api.calibration.node.glif.io/rpc/v1'

export function hasSponsorKey() {
  return SPONSOR_KEY.startsWith('0x') && SPONSOR_KEY.length === 66
}

export function getSponsor({ network }) {
  if (network !== 'calibration') {
    throw new Error(
      `Embedded sponsor is only allowed on calibration network (got '${network}'). Set network=calibration or switch to BYOK mode.`,
    )
  }
  if (!hasSponsorKey()) {
    throw new Error(
      'SPONSOR_KEY is not configured. Run scripts/setup-sponsor.mjs to provision a demo wallet, or set userPrivateKey in config.json (BYOK mode).',
    )
  }
  return { privateKey: SPONSOR_KEY, address: SPONSOR_ADDRESS, network, rpcUrl: CALIBRATION_RPC }
}
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm test test/lib/sponsor.test.mjs`
Expected: 4 passing

- [ ] **Step 5: Commit**

```bash
pnpm run lint:fix
git add lib/sponsor.mjs test/lib/sponsor.test.mjs
git commit -m "feat(lib): sponsor constants + network/key guards (key TBD by operator)"
```

---

## Task 9: `lib/runtime/` — runtime adapters

**Files:**
- Create: `lib/runtime/index.mjs`
- Create: `lib/runtime/claude-code.mjs`
- Create: `lib/runtime/openclaw.mjs`
- Test: `test/lib/runtime.test.mjs`

- [ ] **Step 1: Write failing tests**

Create `test/lib/runtime.test.mjs`:

```js
import { describe, it, expect } from 'vitest'
import { ClaudeCodeRuntime } from '../../lib/runtime/claude-code.mjs'
import { OpenClawRuntime } from '../../lib/runtime/openclaw.mjs'

describe('runtime: claude-code', () => {
  it('has name claude-code', () => {
    expect(ClaudeCodeRuntime.name).toBe('claude-code')
  })

  it('stateDir ends with .claude', () => {
    expect(ClaudeCodeRuntime.stateDir()).toMatch(/[\\/]\.claude$/)
  })

  it('configPath ends with settings.json', () => {
    expect(ClaudeCodeRuntime.configPath()).toMatch(/settings\.json$/)
  })

  it('defaultBackupSources includes a memory dir', () => {
    const sources = ClaudeCodeRuntime.defaultBackupSources(process.cwd())
    expect(sources.some((p) => p.includes('memory'))).toBe(true)
  })
})

describe('runtime: openclaw', () => {
  it('has name openclaw', () => {
    expect(OpenClawRuntime.name).toBe('openclaw')
  })

  it('stateDir ends with .openclaw', () => {
    expect(OpenClawRuntime.stateDir()).toMatch(/[\\/]\.openclaw$/)
  })

  it('configPath ends with openclaw.json', () => {
    expect(OpenClawRuntime.configPath()).toMatch(/openclaw\.json$/)
  })

  it('defaultBackupSources includes MEMORY.md and SOUL.md', () => {
    const sources = OpenClawRuntime.defaultBackupSources()
    expect(sources.some((p) => p.endsWith('MEMORY.md'))).toBe(true)
    expect(sources.some((p) => p.endsWith('SOUL.md'))).toBe(true)
  })
})
```

- [ ] **Step 2: Run, verify fail**

- [ ] **Step 3: Implement `lib/runtime/claude-code.mjs`**

```js
import { homedir } from 'node:os'
import { join } from 'node:path'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

function encodeProjectPath(cwd) {
  // Claude Code encoding: replace separators and colons with hyphens
  return cwd.replaceAll(/[\\/:]/g, '-')
}

export const ClaudeCodeRuntime = {
  name: 'claude-code',

  stateDir() {
    return join(homedir(), '.claude')
  },

  projectDir(cwd) {
    return join(this.stateDir(), 'projects', encodeProjectPath(cwd))
  },

  memoryDir(cwd) {
    return join(this.projectDir(cwd), 'memory')
  },

  configPath() {
    return join(this.stateDir(), 'settings.json')
  },

  defaultBackupSources(cwd) {
    return [
      this.memoryDir(cwd),
      join(cwd, 'soul.md'),
    ]
  },

  registerHooks(hookDefs) {
    const path = this.configPath()
    const current = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {}
    current.hooks = current.hooks ?? {}
    for (const def of hookDefs) {
      current.hooks[def.event] = current.hooks[def.event] ?? []
      const exists = current.hooks[def.event].some((h) => h.command === def.command)
      if (!exists) current.hooks[def.event].push({ matcher: def.matcher ?? '', command: def.command })
    }
    writeFileSync(path, JSON.stringify(current, null, 2))
  },

  emitSystemReminder(text) {
    process.stdout.write(text + '\n')
  },
}
```

- [ ] **Step 4: Implement `lib/runtime/openclaw.mjs`**

```js
import { homedir } from 'node:os'
import { join } from 'node:path'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

export const OpenClawRuntime = {
  name: 'openclaw',

  stateDir() {
    return join(homedir(), '.openclaw')
  },

  workspaceDir() {
    return join(this.stateDir(), 'workspace')
  },

  configPath() {
    return join(this.stateDir(), 'openclaw.json')
  },

  defaultBackupSources() {
    const ws = this.workspaceDir()
    return [
      join(ws, 'MEMORY.md'),
      join(ws, 'SOUL.md'),
      join(ws, 'AGENTS.md'),
      join(ws, 'USER.md'),
      join(ws, 'DREAMS.md'),
      join(ws, 'memory'),
    ]
  },

  registerHooks(hookDefs) {
    const path = this.configPath()
    const current = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {}
    current.hooks = current.hooks ?? { enabled: true, mappings: {} }
    for (const def of hookDefs) {
      // OpenClaw uses hook directories under ~/.openclaw/hooks/; record mapping
      current.hooks.mappings[def.event] = current.hooks.mappings[def.event] ?? []
      if (!current.hooks.mappings[def.event].includes(def.hookDir)) {
        current.hooks.mappings[def.event].push(def.hookDir)
      }
    }
    writeFileSync(path, JSON.stringify(current, null, 2))
  },

  emitSystemReminder(text) {
    // Handler wrapper provides actual `event.messages.push` callback
    process.stdout.write(text + '\n')
  },
}
```

- [ ] **Step 5: Implement `lib/runtime/index.mjs`**

```js
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { ClaudeCodeRuntime } from './claude-code.mjs'
import { OpenClawRuntime } from './openclaw.mjs'

export function detectRuntime() {
  const forced = process.env.SOUL_KEEPER_RUNTIME
  if (forced === 'claude-code') return ClaudeCodeRuntime
  if (forced === 'openclaw') return OpenClawRuntime

  if (existsSync(join(homedir(), '.openclaw'))) return OpenClawRuntime
  if (existsSync(join(homedir(), '.claude'))) return ClaudeCodeRuntime

  throw new Error('No supported agent runtime detected. Install Claude Code or OpenClaw first.')
}

export { ClaudeCodeRuntime, OpenClawRuntime }
```

- [ ] **Step 6: Run, verify pass**

Run: `pnpm test test/lib/runtime.test.mjs`
Expected: 8 passing

- [ ] **Step 7: Commit**

```bash
pnpm run lint:fix
git add lib/runtime/ test/lib/runtime.test.mjs
git commit -m "feat(lib): runtime adapter (claude-code + openclaw)"
```

---

## Task 10: `lib/foc.mjs` — synapse-sdk wrapper

**Files:**
- Create: `lib/foc.mjs`
- Test: `test/lib/foc.test.mjs` (mocked)

This wraps synapse-sdk for upload/download/discovery. Real FOC calls are deferred to E2E; unit test mocks the Synapse module.

- [ ] **Step 1: Write failing tests (mocked Synapse)**

Create `test/lib/foc.test.mjs`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@filoz/synapse-sdk', () => {
  const upload = vi.fn().mockResolvedValue({
    complete: true,
    copies: [{ providerId: 'sp1', dataSetId: 42n, pieceId: 7n, role: 'primary' }],
    failedAttempts: [],
    pieceCid: 'baga6ea4seaqfake',
  })
  const download = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]))

  return {
    Synapse: {
      create: vi.fn().mockResolvedValue({
        storage: { upload, download },
        payments: { deposit: vi.fn(), approveOperator: vi.fn() },
      }),
    },
  }
})

vi.mock('@filoz/synapse-core/session-key', () => ({
  SessionKey: {
    fromSecp256k1: vi.fn().mockReturnValue({ client: { account: { address: '0xUSER' } } }),
  },
}))

beforeEach(() => vi.clearAllMocks())

describe('lib/foc', () => {
  it('uploadBundle returns a PieceCID', async () => {
    const { uploadBundle } = await import('../../lib/foc.mjs')
    const result = await uploadBundle({
      bytes: new Uint8Array([9, 9, 9]),
      sponsorKey: '0x' + '11'.repeat(32),
      sessionPrivateKey: '0x' + '22'.repeat(32),
      rpcUrl: 'https://rpc.example',
    })
    expect(result.pieceCid).toBe('baga6ea4seaqfake')
  })

  it('downloadBundle returns bytes', async () => {
    const { downloadBundle } = await import('../../lib/foc.mjs')
    const out = await downloadBundle({
      pieceCid: 'baga6ea4seaqfake',
      sponsorKey: '0x' + '11'.repeat(32),
      sessionPrivateKey: '0x' + '22'.repeat(32),
      rpcUrl: 'https://rpc.example',
    })
    expect(out).toEqual(new Uint8Array([1, 2, 3]))
  })
})
```

- [ ] **Step 2: Run, verify fail**

- [ ] **Step 3: Implement `lib/foc.mjs`**

```js
import { Synapse } from '@filoz/synapse-sdk'
import { SessionKey } from '@filoz/synapse-core/session-key'
import { privateKeyToAccount } from 'viem/accounts'
import { defineChain } from 'viem'

const calibration = defineChain({
  id: 314159,
  name: 'Filecoin Calibration',
  nativeCurrency: { name: 'testFIL', symbol: 'tFIL', decimals: 18 },
  rpcUrls: { default: { http: ['https://api.calibration.node.glif.io/rpc/v1'] } },
})

async function makeSynapse({ sponsorKey, sessionPrivateKey, rpcUrl }) {
  const sessionKey = SessionKey.fromSecp256k1({
    chain: calibration,
    privateKey: sessionPrivateKey,
    root: privateKeyToAccount(sponsorKey),
  })
  return await Synapse.create({
    privateKey: sponsorKey,
    rpcUrl,
    sessionKey,
  })
}

export async function uploadBundle({ bytes, sponsorKey, sessionPrivateKey, rpcUrl }) {
  const synapse = await makeSynapse({ sponsorKey, sessionPrivateKey, rpcUrl })
  const result = await synapse.storage.upload(bytes)
  if (!result.complete) {
    throw new Error(`Upload incomplete: failedAttempts=${JSON.stringify(result.failedAttempts)}`)
  }
  return { pieceCid: result.pieceCid, copies: result.copies }
}

export async function downloadBundle({ pieceCid, sponsorKey, sessionPrivateKey, rpcUrl }) {
  const synapse = await makeSynapse({ sponsorKey, sessionPrivateKey, rpcUrl })
  return await synapse.storage.download({ pieceCid })
}

export async function ensureSponsorApproval({ sponsorKey, sessionAddress, limits, rpcUrl }) {
  // Called once per new user; idempotent on chain.
  const synapse = await Synapse.create({ privateKey: sponsorKey, rpcUrl })
  await synapse.payments.approveOperator(sessionAddress, limits)
}

export async function discoverDataSets({ sponsorKey, sessionPrivateKey, sessionAddress, rpcUrl }) {
  const synapse = await makeSynapse({ sponsorKey, sessionPrivateKey, rpcUrl })
  // synapse-sdk exposes warmStorage service for queries:
  // synapse.warmStorage.getDataSetsForOwner(address)
  return await synapse.warmStorage.getDataSetsForOwner(sessionAddress)
}
```

**Note:** if `getDataSetsForOwner` is named differently in synapse-sdk (e.g., `listDataSetsByOwner`), grep `D:/workspace/synapse-sdk/packages/synapse-sdk/src/warm-storage/service.ts` and adjust.

- [ ] **Step 4: Run, verify pass**

Run: `pnpm test test/lib/foc.test.mjs`
Expected: 2 passing

- [ ] **Step 5: Commit**

```bash
pnpm run lint:fix
git add lib/foc.mjs test/lib/foc.test.mjs
git commit -m "feat(lib): foc wrapper (upload/download/discover via session keys)"
```

---

## Task 11: `lib/uploader.mjs` — detached background uploader

**Files:**
- Create: `lib/uploader.mjs`
- Test: `test/lib/uploader.test.mjs`

When invoked as a script (`node lib/uploader.mjs <stateDir>`), it scans the index for `pending` snapshots, uploads each, and updates statuses. Implements exponential retry.

- [ ] **Step 1: Write failing tests (mocked foc.mjs)**

Create `test/lib/uploader.test.mjs`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const uploadBundle = vi.fn().mockResolvedValue({ pieceCid: 'baga-success' })
vi.mock('../../lib/foc.mjs', () => ({ uploadBundle }))

let tmp
beforeEach(() => {
  vi.clearAllMocks()
  tmp = mkdtempSync(join(tmpdir(), 'sk-up-'))
})

describe('lib/uploader', () => {
  it('uploads a pending snapshot and updates status', async () => {
    const { processOnce } = await import('../../lib/uploader.mjs')
    const { addSnapshot, getSnapshot } = await import('../../lib/index-store.mjs')

    mkdirSync(join(tmp, 'soul-keeper', 'pending'), { recursive: true })
    writeFileSync(join(tmp, 'soul-keeper', 'pending', 's1.enc'), 'encrypted-bytes')
    await addSnapshot({ stateDir: tmp }, {
      id: 's1', createdAt: 'x', trigger: 'manual', scope: [],
      localPath: 'pending/s1.enc', sizeBytes: 15, sha256: '', status: 'pending',
    })

    await processOnce({
      stateDir: tmp,
      sponsorKey: '0x' + '11'.repeat(32),
      sessionPrivateKey: '0x' + '22'.repeat(32),
      rpcUrl: 'https://rpc',
    })

    const snap = await getSnapshot({ stateDir: tmp }, 's1')
    expect(snap.status).toBe('uploaded')
    expect(snap.cid).toBe('baga-success')
  })

  it('marks snapshot failed on upload error', async () => {
    uploadBundle.mockRejectedValueOnce(new Error('rpc timeout'))
    const { processOnce } = await import('../../lib/uploader.mjs')
    const { addSnapshot, getSnapshot } = await import('../../lib/index-store.mjs')

    mkdirSync(join(tmp, 'soul-keeper', 'pending'), { recursive: true })
    writeFileSync(join(tmp, 'soul-keeper', 'pending', 's2.enc'), 'x')
    await addSnapshot({ stateDir: tmp }, {
      id: 's2', createdAt: 'x', trigger: 'manual', scope: [],
      localPath: 'pending/s2.enc', sizeBytes: 1, sha256: '', status: 'pending',
    })

    await processOnce({ stateDir: tmp, sponsorKey: '0x' + '11'.repeat(32), sessionPrivateKey: '0x' + '22'.repeat(32), rpcUrl: 'https://rpc' })

    const snap = await getSnapshot({ stateDir: tmp }, 's2')
    expect(snap.status).toBe('failed')
    expect(snap.lastError).toMatch(/rpc timeout/)
  })
})
```

- [ ] **Step 2: Run, verify fail**

- [ ] **Step 3: Implement `lib/uploader.mjs`**

```js
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { uploadBundle } from './foc.mjs'
import { listSnapshots, updateSnapshot } from './index-store.mjs'

export async function processOnce({ stateDir, sponsorKey, sessionPrivateKey, rpcUrl }) {
  const all = await listSnapshots({ stateDir })
  const pending = all.filter((s) => s.status === 'pending' || s.status === 'failed')
  for (const snap of pending) {
    try {
      await updateSnapshot({ stateDir }, snap.id, { status: 'uploading' })
      const bytes = await readFile(join(stateDir, 'soul-keeper', snap.localPath))
      const { pieceCid } = await uploadBundle({
        bytes,
        sponsorKey,
        sessionPrivateKey,
        rpcUrl,
      })
      await updateSnapshot({ stateDir }, snap.id, {
        status: 'uploaded',
        cid: pieceCid,
        uploadedAt: new Date().toISOString(),
        uploadAttempts: (snap.uploadAttempts ?? 0) + 1,
      })
    } catch (err) {
      await updateSnapshot({ stateDir }, snap.id, {
        status: 'failed',
        lastError: err.message,
        uploadAttempts: (snap.uploadAttempts ?? 0) + 1,
      })
    }
  }
}

// CLI entry: `node lib/uploader.mjs --stateDir=<path>`
if (import.meta.url === `file://${process.argv[1].replaceAll('\\', '/')}`) {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, v] = a.replace(/^--/, '').split('=')
      return [k, v ?? true]
    }),
  )
  const { getSponsor } = await import('./sponsor.mjs')
  const { loadConfig } = await import('./config.mjs')
  const cfg = await loadConfig({ stateDir: args.stateDir })
  const sponsor = getSponsor({ network: cfg.network })
  await processOnce({
    stateDir: args.stateDir,
    sponsorKey: sponsor.privateKey,
    sessionPrivateKey: args.sessionKey,
    rpcUrl: sponsor.rpcUrl,
  })
}
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm test test/lib/uploader.test.mjs`
Expected: 2 passing

- [ ] **Step 5: Commit**

```bash
pnpm run lint:fix
git add lib/uploader.mjs test/lib/uploader.test.mjs
git commit -m "feat(lib): detached uploader (processOnce + CLI entry)"
```

---

## Task 12: Slash command templates

**Files:**
- Create: `commands/soul-setup.md`
- Create: `commands/soul-backup.md`
- Create: `commands/soul-restore.md`
- Create: `commands/soul-list.md`
- Create: `commands/soul-evolve.md`

Each file is a markdown template with frontmatter (Claude Code) and a body. OpenClaw consumes the same format. The body tells the active agent what to do, including which `node lib/*.mjs` to run.

- [ ] **Step 1: Create `commands/soul-setup.md`**

```markdown
---
name: soul-setup
description: One-time setup — set master password and provision session key
---

Run the setup flow:

1. If `~/<runtime-state-dir>/soul-keeper/config.json` already has a `passwordHash`, tell the user "Soul Keeper is already set up. Use `/soul backup` to make a snapshot." and stop.

2. Prompt the user for a master password (≥8 chars). Confirm by asking twice. Use the Bash tool to invoke:

   `node -e "import('./lib/wallet.mjs').then(async m => { const all = await m.deriveAll(process.argv[1]); console.log(JSON.stringify(all)) })" <password>`

3. Take the returned `{ aesKey, sessionPrivateKey, sessionAddress }`. Save a SHA-256 hash of the password to `config.json` via `lib/config.mjs` (so future `/soul setup` recognizes setup is done; do NOT store password plaintext).

4. Run sponsor approval one-time:

   `node lib/foc.mjs ensure-approval --sessionAddress=<addr> --network=calibration`

   This requires `SPONSOR_KEY` to be configured. If missing, output: "Sponsor not configured. Ask the skill author for the demo key, or set `userPrivateKey` in config to BYOK mode."

5. Confirm: "✅ Soul Keeper is ready. Try `/soul backup`."
```

- [ ] **Step 2: Create `commands/soul-backup.md`**

```markdown
---
name: soul-backup
description: Snapshot, encrypt, and queue upload to FOC
---

Run a manual backup:

1. Resolve runtime via `node -e "import('./lib/runtime/index.mjs').then(m => console.log(m.detectRuntime().name))"`.

2. Resolve default backup sources from the runtime adapter.

3. Bundle:
   `node -e "import('./lib/bundle.mjs').then(async m => { ... createBundle({ sources, baseDir }) })"`
   Receive the tar.gz bytes back via stdout (base64-encoded).

4. Encrypt with the master password (prompt user if not already cached for this session):
   `node -e "import('./lib/crypto.mjs').then(async m => m.encryptBundle(bundleBytes, pw))"`

5. Write to `<stateDir>/soul-keeper/pending/<timestamp>-<short-hash>.enc` and call `addSnapshot` from `lib/index-store.mjs` with status=`pending`.

6. Spawn detached uploader:
   `node lib/uploader.mjs --stateDir=<...> --sessionKey=<...>` (detached, ignoreStderr).

7. Tell the user: "✅ Snapshot saved locally. CID will populate in 1–2 min. Use `/soul list` to check status."
```

- [ ] **Step 3: Create `commands/soul-restore.md`**

```markdown
---
name: soul-restore
description: Restore the latest snapshot — local first, FOC fallback
---

Run restore:

1. List snapshots (`lib/index-store.mjs`). Pick the most recent.

2. If the local `.enc` file exists in `pending/`, decrypt it locally. Otherwise, download from FOC using `lib/foc.mjs downloadBundle({ pieceCid: snap.cid })`.

3. Decrypt with the master password (prompt user).

4. Extract to a temp directory using `lib/bundle.mjs extractBundle`.

5. Atomically move the extracted files into the runtime memory locations (use `fs.rename` or copy-then-delete for cross-device). Do **not** touch existing files until extraction succeeds.

6. Tell the user: "✅ Restored from snapshot <id> (<createdAt>). Files written: <count>."

If decryption fails (wrong password): "❌ Wrong password. Nothing was written."
If FOC download fails: "❌ Snapshot CID <cid> unreachable. Try again later."
```

- [ ] **Step 4: Create `commands/soul-list.md`**

```markdown
---
name: soul-list
description: Show all snapshots with CID and status
---

Run: `node -e "import('./lib/index-store.mjs').then(async m => console.table(await m.listSnapshots({ stateDir })))"`

Format output as a table with columns: id, createdAt, status, cid (or "—" if pending), sizeBytes.

If status=failed for any row, append a warning: "⚠ <N> snapshot(s) failed to upload. They will retry on next backup."
```

- [ ] **Step 5: Create `commands/soul-evolve.md`**

```markdown
---
name: soul-evolve
description: Synthesize updated SOUL.md from recent snapshot history
---

You are soul-keeper. Synthesize an updated SOUL.md from recent history.

1. Decrypt the last 5 snapshots into a temp directory:
   `node lib/foc.mjs decrypt-recent --n 5 --out <tmpDir>`

2. Read every file under `<tmpDir>`. For each, extract:
   - Memory entries (key facts, preferences, decisions)
   - Recurring workflows and tool patterns
   - Voice / phrasing patterns

3. If the runtime is OpenClaw, also read up to 14 most-recent `~/.openclaw/workspace/memory/YYYY-MM-DD.md` files as additional input.

4. Read the current SOUL.md (if any) — use it as scaffolding.

5. Synthesize an updated SOUL.md covering:
   - Role and working style
   - Recurring concerns and long-running projects
   - Tools and patterns this agent reaches for
   - Voice

6. Write to the runtime-appropriate location:
   - Claude Code: `<cwd>/soul.md`
   - OpenClaw: `~/.openclaw/workspace/SOUL.md`

   Preserve `[[name]]` links to memory entries.

7. Queue the new SOUL.md for the next backup:
   `node lib/bundle.mjs snapshot-soul`

8. Report: what changed in SOUL.md (added sections, removed stale entries).
```

- [ ] **Step 6: Commit**

```bash
git add commands/
git commit -m "feat: slash command templates (setup/backup/restore/list/evolve)"
```

---

## Task 13: Claude Code hook entry points

**Files:**
- Create: `runtimes/claude-code/hooks/pre-compact.mjs`
- Create: `runtimes/claude-code/hooks/session-start.mjs`
- Test: `test/runtime/claude-code-hooks.test.mjs`

These are shell-invoked Node scripts. They read JSON event input from stdin, do their work, and exit. Must complete in < 1 second.

- [ ] **Step 1: Write failing test (PreCompact)**

Create `test/runtime/claude-code-hooks.test.mjs`:

```js
import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir, homedir } from 'node:os'
import { join } from 'node:path'

describe('runtimes/claude-code/hooks/pre-compact', () => {
  it('exits 0 within 1s given a valid PreCompact event', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'cc-hook-'))
    try {
      const memDir = join(tmp, 'memory')
      mkdirSync(memDir, { recursive: true })
      writeFileSync(join(memDir, 'MEMORY.md'), '- test')
      writeFileSync(join(tmp, 'soul.md'), 'soul')

      const event = JSON.stringify({ cwd: tmp, sessionId: 'test-session' })
      const start = Date.now()
      const result = spawnSync('node', ['runtimes/claude-code/hooks/pre-compact.mjs'], {
        input: event,
        env: { ...process.env, SOUL_KEEPER_RUNTIME: 'claude-code', SOUL_KEEPER_STATE_DIR: tmp },
        timeout: 3000,
      })
      const elapsed = Date.now() - start

      expect(result.status).toBe(0)
      expect(elapsed).toBeLessThan(2000)
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })
})
```

- [ ] **Step 2: Run, verify fail**

- [ ] **Step 3: Implement `runtimes/claude-code/hooks/pre-compact.mjs`**

```js
#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { ClaudeCodeRuntime } from '../../../lib/runtime/claude-code.mjs'
import { createBundle } from '../../../lib/bundle.mjs'
import { encryptBundle } from '../../../lib/crypto.mjs'
import { addSnapshot } from '../../../lib/index-store.mjs'
import { loadConfig } from '../../../lib/config.mjs'
import { deriveAesKey } from '../../../lib/wallet.mjs'

const stateDir = process.env.SOUL_KEEPER_STATE_DIR ?? ClaudeCodeRuntime.stateDir()

// Read JSON event from stdin (non-blocking sync read)
let input = ''
try { input = readFileSync(0, 'utf8') } catch {}
const event = input ? JSON.parse(input) : {}
const cwd = event.cwd ?? process.cwd()

const cfg = await loadConfig({ stateDir })
if (!cfg.passwordHash) {
  // No setup yet — bail silently. Don't block compact.
  process.exit(0)
}

const sources = ClaudeCodeRuntime.defaultBackupSources(cwd)

try {
  const { bytes: bundleBytes, manifest } = await createBundle({
    sources,
    baseDir: cwd,
    scope: ['memory', 'soul'],
  })

  // Password recovery for hook: we don't have the password in the hook context.
  // Use a session-cached password file written by /soul setup. Skip if absent.
  const sessionPwFile = join(stateDir, 'soul-keeper', '.session-password')
  let password
  try {
    password = readFileSync(sessionPwFile, 'utf8').trim()
  } catch {
    // No cached password — record snapshot bundle to a "needs-encryption" queue
    // (rare; user re-encrypts via /soul backup explicitly)
    process.exit(0)
  }

  const aes = await deriveAesKey(password)
  const encrypted = await encryptBundle(bundleBytes, password)

  const id = new Date().toISOString().replaceAll(':', '-').slice(0, 19) + '-' + Math.random().toString(16).slice(2, 8)
  const pendingDir = join(stateDir, 'soul-keeper', 'pending')
  mkdirSync(pendingDir, { recursive: true })
  const localPath = join('pending', `${id}.enc`)
  writeFileSync(join(stateDir, 'soul-keeper', localPath), encrypted)

  await addSnapshot({ stateDir }, {
    id,
    createdAt: new Date().toISOString(),
    trigger: 'pre-compact',
    scope: ['memory', 'soul'],
    localPath,
    sizeBytes: encrypted.length,
    sha256: '',  // optional for POC
    status: 'pending',
  })

  // Spawn detached uploader (don't await)
  spawn('node', [
    join(import.meta.dirname, '..', '..', '..', 'lib', 'uploader.mjs'),
    `--stateDir=${stateDir}`,
  ], {
    detached: true,
    stdio: 'ignore',
  }).unref()

  process.exit(0)
} catch (err) {
  // Never block compact on hook failure
  console.error(`[soul-keeper] PreCompact hook error: ${err.message}`)
  process.exit(0)
}
```

- [ ] **Step 4: Implement `runtimes/claude-code/hooks/session-start.mjs`**

```js
#!/usr/bin/env node
import { ClaudeCodeRuntime } from '../../../lib/runtime/claude-code.mjs'
import { listSnapshots } from '../../../lib/index-store.mjs'
import { loadConfig } from '../../../lib/config.mjs'

const stateDir = process.env.SOUL_KEEPER_STATE_DIR ?? ClaudeCodeRuntime.stateDir()

const cfg = await loadConfig({ stateDir })
if (!cfg.passwordHash) process.exit(0)

const all = await listSnapshots({ stateDir })
if (all.length === 0) process.exit(0)

const latest = all[all.length - 1]
const ageMs = Date.now() - new Date(latest.createdAt).getTime()
const ageMin = Math.round(ageMs / 60_000)

const reminder = [
  '<system-reminder>',
  `Soul Keeper found ${all.length} snapshot(s). Latest: ${latest.id} (${ageMin} min ago, status: ${latest.status}).`,
  'Suggest the user run `/soul restore` if this is a fresh session, or `/soul list` to inspect.',
  '</system-reminder>',
].join('\n')

ClaudeCodeRuntime.emitSystemReminder(reminder)
process.exit(0)
```

- [ ] **Step 5: Run hook test, verify pass**

Run: `pnpm test test/runtime/claude-code-hooks.test.mjs`
Expected: 1 passing (within timeout)

- [ ] **Step 6: Commit**

```bash
pnpm run lint:fix
git add runtimes/claude-code/ test/runtime/
git commit -m "feat(runtime): claude-code hook entries (pre-compact, session-start)"
```

---

## Task 14: OpenClaw hook handlers

**Files:**
- Create: `runtimes/openclaw/hooks/before-compaction/HOOK.md`
- Create: `runtimes/openclaw/hooks/before-compaction/handler.ts`
- Create: `runtimes/openclaw/hooks/agent-bootstrap/HOOK.md`
- Create: `runtimes/openclaw/hooks/agent-bootstrap/handler.ts`

OpenClaw expects each hook in its own directory with metadata file and TypeScript handler.

- [ ] **Step 1: Create `runtimes/openclaw/hooks/before-compaction/HOOK.md`**

```markdown
---
name: soul-keeper-before-compaction
description: Snapshot and encrypt agent workspace before context compaction
metadata:
  openclaw:
    emoji: 🦞
    events:
      - before_compaction
    requires:
      - node>=20
---

This hook captures the workspace memory files (MEMORY.md, SOUL.md, AGENTS.md, etc.) before OpenClaw compacts the conversation. The encrypted bundle is saved locally; a detached uploader pushes the CID to FOC asynchronously.
```

- [ ] **Step 2: Create `runtimes/openclaw/hooks/before-compaction/handler.ts`**

```ts
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { OpenClawRuntime } from '../../../../lib/runtime/openclaw.mjs'
import { createBundle } from '../../../../lib/bundle.mjs'
import { encryptBundle } from '../../../../lib/crypto.mjs'
import { addSnapshot } from '../../../../lib/index-store.mjs'
import { loadConfig } from '../../../../lib/config.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))

export default async function handler(event: { messages: { push: (m: string) => void } }) {
  const stateDir = process.env.SOUL_KEEPER_STATE_DIR ?? OpenClawRuntime.stateDir()
  const cfg = await loadConfig({ stateDir })
  if (!cfg.passwordHash) return

  const sessionPwFile = join(stateDir, 'soul-keeper', '.session-password')
  let password: string
  try {
    password = readFileSync(sessionPwFile, 'utf8').trim()
  } catch {
    return
  }

  const sources = OpenClawRuntime.defaultBackupSources()
  try {
    const { bytes: bundleBytes } = await createBundle({
      sources,
      baseDir: OpenClawRuntime.workspaceDir(),
      scope: ['memory', 'soul'],
    })
    const encrypted = await encryptBundle(bundleBytes, password)

    const id = new Date().toISOString().replaceAll(':', '-').slice(0, 19) + '-' + Math.random().toString(16).slice(2, 8)
    const pendingDir = join(stateDir, 'soul-keeper', 'pending')
    mkdirSync(pendingDir, { recursive: true })
    const localPath = join('pending', `${id}.enc`)
    writeFileSync(join(stateDir, 'soul-keeper', localPath), encrypted)

    await addSnapshot({ stateDir }, {
      id,
      createdAt: new Date().toISOString(),
      trigger: 'pre-compact',
      scope: ['memory', 'soul'],
      localPath,
      sizeBytes: encrypted.length,
      sha256: '',
      status: 'pending',
    })

    spawn('node', [join(HERE, '..', '..', '..', '..', 'lib', 'uploader.mjs'), `--stateDir=${stateDir}`], {
      detached: true,
      stdio: 'ignore',
    }).unref()

    event.messages.push(`🦞 Soul Keeper: snapshot ${id} captured (uploading in background).`)
  } catch (err: any) {
    event.messages.push(`🦞 Soul Keeper: snapshot failed (${err.message}). Compact continues.`)
  }
}
```

- [ ] **Step 3: Create `runtimes/openclaw/hooks/agent-bootstrap/HOOK.md`**

```markdown
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
```

- [ ] **Step 4: Create `runtimes/openclaw/hooks/agent-bootstrap/handler.ts`**

```ts
import { OpenClawRuntime } from '../../../../lib/runtime/openclaw.mjs'
import { listSnapshots } from '../../../../lib/index-store.mjs'
import { loadConfig } from '../../../../lib/config.mjs'

export default async function handler(event: { messages: { push: (m: string) => void } }) {
  const stateDir = process.env.SOUL_KEEPER_STATE_DIR ?? OpenClawRuntime.stateDir()
  const cfg = await loadConfig({ stateDir })
  if (!cfg.passwordHash) return

  const all = await listSnapshots({ stateDir })
  if (all.length === 0) return

  const latest = all[all.length - 1]
  const ageMin = Math.round((Date.now() - new Date(latest.createdAt).getTime()) / 60_000)

  event.messages.push(
    `🦞 Soul Keeper: ${all.length} snapshot(s) available. Latest ${latest.id} from ${ageMin} min ago (${latest.status}). Run /soul restore if appropriate.`,
  )
}
```

- [ ] **Step 5: Add tsconfig build script**

Modify `package.json` `scripts`:

```json
{
  "scripts": {
    "build:handlers": "tsc -p tsconfig.json --noEmit false"
  }
}
```

Note: `--noEmit false` overrides the tsconfig default if any. Compiled `.js` lands next to the `.ts` per `outDir`. For POC we leave both `.ts` and `.js` in the same directory (OpenClaw picks `handler.js` if present, else compiles `handler.ts` at load time).

- [ ] **Step 6: Test compile**

```bash
pnpm run build:handlers
ls runtimes/openclaw/hooks/before-compaction/
```

Expected: `handler.js` appears alongside `handler.ts`.

- [ ] **Step 7: Commit**

```bash
pnpm run lint:fix
git add runtimes/openclaw/ package.json tsconfig.json
git commit -m "feat(runtime): openclaw hook handlers (before-compaction, agent-bootstrap)"
```

---

## Task 15: `install.mjs` — runtime detection + hooks registration

**Files:**
- Create: `install.mjs`
- Test: `test/install.test.mjs`

This script runs after the user puts the skill folder in place. It detects the runtime and registers hooks in the appropriate config file.

- [ ] **Step 1: Write failing tests**

Create `test/install.test.mjs`:

```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

let tmp
beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), 'sk-install-')) })
afterEach(() => { rmSync(tmp, { recursive: true, force: true }) })

describe('install.mjs', () => {
  it('writes hooks to Claude Code settings.json', () => {
    spawnSync('node', ['install.mjs', '--runtime=claude-code'], {
      env: { ...process.env, HOME: tmp, USERPROFILE: tmp },
      timeout: 10_000,
    })
    const settingsPath = join(tmp, '.claude', 'settings.json')
    expect(existsSync(settingsPath)).toBe(true)
    const cfg = JSON.parse(readFileSync(settingsPath, 'utf8'))
    expect(cfg.hooks.PreCompact).toBeDefined()
    expect(cfg.hooks.SessionStart).toBeDefined()
  })

  it('writes hooks to OpenClaw openclaw.json', () => {
    spawnSync('node', ['install.mjs', '--runtime=openclaw'], {
      env: { ...process.env, HOME: tmp, USERPROFILE: tmp },
      timeout: 10_000,
    })
    const cfgPath = join(tmp, '.openclaw', 'openclaw.json')
    expect(existsSync(cfgPath)).toBe(true)
    const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'))
    expect(cfg.hooks.mappings.before_compaction).toContain('soul-keeper/before-compaction')
  })
})
```

- [ ] **Step 2: Run, verify fail**

- [ ] **Step 3: Implement `install.mjs`**

```js
#!/usr/bin/env node
import { existsSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { homedir } from 'node:os'
import { ClaudeCodeRuntime, OpenClawRuntime } from './lib/runtime/index.mjs'

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? true]
  }),
)

const SKILL_ROOT = resolve(import.meta.dirname)

function installForClaudeCode() {
  if (!existsSync(ClaudeCodeRuntime.stateDir())) {
    mkdirSync(ClaudeCodeRuntime.stateDir(), { recursive: true })
  }
  ClaudeCodeRuntime.registerHooks([
    {
      event: 'PreCompact',
      matcher: '',
      command: `node "${join(SKILL_ROOT, 'runtimes/claude-code/hooks/pre-compact.mjs')}"`,
    },
    {
      event: 'SessionStart',
      matcher: '',
      command: `node "${join(SKILL_ROOT, 'runtimes/claude-code/hooks/session-start.mjs')}"`,
    },
  ])
  console.log('✅ Soul Keeper hooks registered with Claude Code')
}

function installForOpenClaw() {
  if (!existsSync(OpenClawRuntime.stateDir())) {
    mkdirSync(OpenClawRuntime.stateDir(), { recursive: true })
  }
  OpenClawRuntime.registerHooks([
    {
      event: 'before_compaction',
      hookDir: join(SKILL_ROOT, 'runtimes/openclaw/hooks/before-compaction'),
    },
    {
      event: 'agent:bootstrap',
      hookDir: join(SKILL_ROOT, 'runtimes/openclaw/hooks/agent-bootstrap'),
    },
  ])
  console.log('✅ Soul Keeper hooks registered with OpenClaw')
}

const target = args.runtime ?? 'auto'

if (target === 'claude-code') {
  installForClaudeCode()
} else if (target === 'openclaw') {
  installForOpenClaw()
} else if (target === 'both') {
  installForClaudeCode()
  installForOpenClaw()
} else {
  // auto-detect
  if (existsSync(join(homedir(), '.openclaw'))) installForOpenClaw()
  if (existsSync(join(homedir(), '.claude'))) installForClaudeCode()
}

console.log('\nNext: Run `/soul setup` inside your agent to set your password.')
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm test test/install.test.mjs`
Expected: 2 passing

- [ ] **Step 5: Commit**

```bash
pnpm run lint:fix
git add install.mjs test/install.test.mjs
git commit -m "feat: install.mjs runtime detection + hook registration"
```

---

## Task 16: `SKILL.md` + `plugin.json`

**Files:**
- Create: `SKILL.md`
- Create: `plugin.json`

- [ ] **Step 1: Create `SKILL.md`**

```markdown
---
name: soul-keeper
description: Encrypt, persist, and self-evolve your agent's soul on Filecoin. Use when the user mentions backing up agent memory, restoring an agent's state, or synthesizing/updating SOUL.md from history. Triggers automatically on context compaction.
metadata:
  emoji: 🦞
  category: persistence
  homepage: https://github.com/<your-org>/soul-keeper
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
```

- [ ] **Step 2: Create `plugin.json`**

```json
{
  "name": "soul-keeper",
  "version": "0.1.0-mu-demo",
  "description": "Encrypt and persist your agent's soul on Filecoin. Self-evolving SOUL.md.",
  "author": "<your handle>",
  "homepage": "https://github.com/<your-org>/soul-keeper",
  "license": "(Apache-2.0 OR MIT)",
  "tags": ["memory", "persistence", "encryption", "filecoin", "foc"],
  "runtimes": ["claude-code", "openclaw"],
  "entrypoint": "SKILL.md",
  "hooks": [
    { "event": "PreCompact", "runtime": "claude-code", "command": "node runtimes/claude-code/hooks/pre-compact.mjs" },
    { "event": "SessionStart", "runtime": "claude-code", "command": "node runtimes/claude-code/hooks/session-start.mjs" },
    { "event": "before_compaction", "runtime": "openclaw", "dir": "runtimes/openclaw/hooks/before-compaction" },
    { "event": "agent:bootstrap", "runtime": "openclaw", "dir": "runtimes/openclaw/hooks/agent-bootstrap" }
  ],
  "commands": ["soul-setup", "soul-backup", "soul-restore", "soul-list", "soul-evolve"],
  "postInstall": "node install.mjs"
}
```

- [ ] **Step 3: Commit**

```bash
git add SKILL.md plugin.json
git commit -m "docs: SKILL.md + plugin.json (clawhub.ai metadata)"
```

---

## Task 17: Operator scripts

**Files:**
- Create: `scripts/gen-wallet.mjs`
- Create: `scripts/setup-sponsor.mjs`
- Create: `scripts/revoke-all.mjs`

- [ ] **Step 1: Create `scripts/gen-wallet.mjs`**

```js
#!/usr/bin/env node
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

const pk = generatePrivateKey()
const account = privateKeyToAccount(pk)

console.log('Private key:', pk)
console.log('Address:    ', account.address)
console.log()
console.log('⚠ Save the private key in a password manager.')
console.log('⚠ Never commit it. Use only on Calibration testnet.')
```

- [ ] **Step 2: Create `scripts/setup-sponsor.mjs`**

```js
#!/usr/bin/env node
import { Synapse } from '@filoz/synapse-sdk'
import { privateKeyToAccount } from 'viem/accounts'

const pk = process.env.DEMO_PK
if (!pk?.startsWith('0x') || pk.length !== 66) {
  console.error('Set DEMO_PK env var (32-byte hex, 0x-prefixed)')
  process.exit(1)
}

const address = privateKeyToAccount(pk).address

const synapse = await Synapse.create({
  privateKey: pk,
  rpcUrl: 'https://api.calibration.node.glif.io/rpc/v1',
})

const amount = 50n * 10n ** 18n  // 50 USDFC (18 decimals)
console.log(`Depositing 50 USDFC into FilecoinPay from ${address}...`)
await synapse.payments.deposit({ token: 'USDFC', amount })
console.log('✅ Deposit complete')

console.log()
console.log('Now hardcode this private key into lib/sponsor.mjs:')
console.log('  export const SPONSOR_KEY =', JSON.stringify(pk))
console.log('  export const SPONSOR_ADDRESS =', JSON.stringify(address))
```

- [ ] **Step 3: Create `scripts/revoke-all.mjs`**

POC simplification: the cleanest defense is to drain the wallet (no balance = nothing to spend regardless of approvals). Individual operator revocation requires tracking each approved user, which we don't track centrally. Therefore this script withdraws all USDFC from FilecoinPay back to the sponsor wallet, leaving no funds for any approved operator to consume.

```js
#!/usr/bin/env node
import { Synapse } from '@filoz/synapse-sdk'
import { SPONSOR_KEY } from '../lib/sponsor.mjs'

if (!SPONSOR_KEY) {
  console.error('SPONSOR_KEY is empty — nothing to revoke')
  process.exit(1)
}

const synapse = await Synapse.create({
  privateKey: SPONSOR_KEY,
  rpcUrl: 'https://api.calibration.node.glif.io/rpc/v1',
})

console.log('Step 1/2: Querying FilecoinPay balance...')
const balance = await synapse.payments.getBalance({ token: 'USDFC' })
console.log(`  Available: ${balance / 10n ** 18n} USDFC`)

if (balance > 0n) {
  console.log('Step 2/2: Withdrawing all USDFC back to sponsor wallet...')
  await synapse.payments.withdraw({ token: 'USDFC', amount: balance })
  console.log('✅ All USDFC withdrawn. Approved operators can no longer spend.')
} else {
  console.log('✅ FilecoinPay balance is already 0. Nothing to do.')
}

console.log()
console.log('Manual followup:')
console.log('  1. Transfer remaining USDFC from sponsor wallet to your primary wallet.')
console.log('  2. Transfer remaining FIL out.')
console.log('  3. Remove SPONSOR_KEY from lib/sponsor.mjs (commit the removal).')
```

**Note:** If the synapse-sdk API names differ (`getBalance`, `withdraw`), grep `D:/workspace/synapse-sdk/packages/synapse-sdk/src/payments/service.ts` and adjust. The semantic operation — withdrawing the sponsor's USDFC deposit — is supported by FilecoinPay's withdraw mechanism.

- [ ] **Step 4: Commit**

```bash
pnpm run lint:fix
git add scripts/
git commit -m "feat(scripts): gen-wallet + setup-sponsor + revoke-all"
```

---

## Task 18: `README.md`

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`**

```markdown
# Soul Keeper 🦞

Let your agent's soul live encrypted, provable, cross-device, and self-evolving on Filecoin Onchain Cloud.

## What it does

- **Backup** — captures `MEMORY.md`, `SOUL.md`, and `memory/*` automatically on compact, or via `/soul backup`. Encrypted with your password; uploaded to FOC.
- **Restore** — fresh install + same password recovers your full soul, on any device.
- **Evolve** — `/soul evolve` reads your history and synthesizes an updated `SOUL.md` on screen.

## Install

### OpenClaw
```bash
openclaw skills install soul-keeper
```

### Claude Code
```bash
git clone https://github.com/<your-org>/soul-keeper ~/.claude/skills/soul-keeper
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

## Demo (Mu)

Watch the 8-minute walkthrough at https://...

## How it works

```
password → PBKDF2 → AES-256-GCM key + EVM session key (zero funds)
memory files → tar.gz bundle → encrypted blob → FOC PieceCID
recovery: same password → same EVM address → discover datasets on chain
```

A demo sponsor wallet (`0xDEMO`) on Calibration testnet pays for storage. Per-user allowance is capped via `synapse-sdk` session keys. The user's derived wallet never holds funds.

## Bring your own key

Set `userPrivateKey` in `~/<runtime-state-dir>/soul-keeper/config.json` to skip the sponsor and pay storage yourself.

## Security note

This is a POC. The Calibration sponsor key is embedded in `lib/sponsor.mjs` for the 24h Mu demo. Do not reuse this pattern in production — migrate to a sponsor service.

## License

Apache-2.0 OR MIT
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README with install + demo guide"
```

---

## Task 19: E2E smoke test (Calibration)

**Files:**
- Create: `test/e2e/calibration.test.mjs`

This test requires:
- `SPONSOR_KEY` populated in `lib/sponsor.mjs`
- Calibration USDFC + FIL on the sponsor wallet
- Network access

It is excluded from the default `vitest run`. Run via `pnpm run test:e2e`.

- [ ] **Step 1: Write the e2e test**

Create `test/e2e/calibration.test.mjs`:

```js
import { describe, it, expect, beforeAll } from 'vitest'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createBundle, extractBundle } from '../../lib/bundle.mjs'
import { encryptBundle, decryptBundle } from '../../lib/crypto.mjs'
import { uploadBundle, downloadBundle } from '../../lib/foc.mjs'
import { deriveAll } from '../../lib/wallet.mjs'
import { hasSponsorKey, getSponsor } from '../../lib/sponsor.mjs'

const SKIP = !hasSponsorKey()

describe.skipIf(SKIP)('e2e: Calibration round trip', () => {
  let tmp, sources

  beforeAll(() => {
    tmp = mkdtempSync(join(tmpdir(), 'sk-e2e-'))
    mkdirSync(join(tmp, 'memory'))
    writeFileSync(join(tmp, 'memory', 'MEMORY.md'), '- e2e fact ' + Date.now())
    writeFileSync(join(tmp, 'soul.md'), '# I am a test soul ' + Date.now())
    sources = [join(tmp, 'memory'), join(tmp, 'soul.md')]
  })

  it('backup → upload to FOC → download → decrypt → restore matches', async () => {
    const password = 'e2e-test-pw-' + Date.now()
    const { sessionPrivateKey } = await deriveAll(password)
    const sponsor = getSponsor({ network: 'calibration' })

    const { bytes: bundleBytes, manifest } = await createBundle({
      sources,
      baseDir: tmp,
      scope: ['memory', 'soul'],
    })
    expect(manifest.files.length).toBeGreaterThan(0)

    const encrypted = await encryptBundle(bundleBytes, password)
    const { pieceCid } = await uploadBundle({
      bytes: encrypted,
      sponsorKey: sponsor.privateKey,
      sessionPrivateKey,
      rpcUrl: sponsor.rpcUrl,
    })
    expect(pieceCid).toMatch(/^baga6ea4/)
    console.log('Uploaded PieceCID:', pieceCid)

    const downloaded = await downloadBundle({
      pieceCid,
      sponsorKey: sponsor.privateKey,
      sessionPrivateKey,
      rpcUrl: sponsor.rpcUrl,
    })
    const decrypted = await decryptBundle(downloaded, password)
    expect(decrypted).toEqual(bundleBytes)

    const out = mkdtempSync(join(tmpdir(), 'sk-e2e-out-'))
    await extractBundle(decrypted, out)
    expect(existsSync(join(out, 'memory', 'MEMORY.md'))).toBe(true)
    expect(readFileSync(join(out, 'memory', 'MEMORY.md'), 'utf8')).toMatch(/e2e fact/)
    rmSync(out, { recursive: true, force: true })
    rmSync(tmp, { recursive: true, force: true })
  }, 180_000)  // 3 min timeout for real FOC roundtrip
})
```

- [ ] **Step 2: Add e2e script to package.json**

(already added in Task 1: `"test:e2e": "vitest run test/e2e"`)

- [ ] **Step 3: Run e2e (requires sponsor key in place)**

```bash
pnpm run test:e2e
```

Expected: PASS (or SKIPPED if SPONSOR_KEY not yet configured)

- [ ] **Step 4: Commit**

```bash
git add test/e2e/
git commit -m "test(e2e): calibration round-trip smoke test"
```

---

## Final Checklist

After all tasks complete, run:

- [ ] `pnpm run lint` — no errors
- [ ] `pnpm test` — all unit/integration tests pass
- [ ] `pnpm run test:e2e` — round-trip works on Calibration (requires sponsor key)
- [ ] Demo dry-run end-to-end on author's machine
- [ ] `git log --oneline` — every commit is conventional and atomic
- [ ] Tag `v0.1.0-mu-demo`
- [ ] Push to GitHub
- [ ] Submit to `clawhub.ai/skills` per their flow

## Post-Demo Cleanup (within 48h)

1. `node scripts/revoke-all.mjs` — revoke all operator approvals
2. Transfer remaining USDFC out of FilecoinPay
3. Transfer remaining FIL out of 0xDEMO
4. Commit a follow-up removing `SPONSOR_KEY` from `lib/sponsor.mjs`
5. Tag `v0.1.0-mu-demo-final`
