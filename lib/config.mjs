import { mkdir, readFile, writeFile } from 'node:fs/promises'
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
