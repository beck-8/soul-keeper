import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
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
      const backup = `${indexPath({ stateDir })}.broken-${Date.now()}`
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
