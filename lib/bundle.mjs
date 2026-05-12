import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { Readable } from 'node:stream'
import { createGunzip, createGzip } from 'node:zlib'
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
      files.push({
        absPath: src,
        relPath: relative(baseDir, src).replaceAll('\\', '/'),
        size: stat.size,
      })
    }
  }
  return { files, skipped }
}

function walkDir(dir, out, baseDir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walkDir(full, out, baseDir)
    else
      out.push({
        absPath: full,
        relPath: relative(baseDir, full).replaceAll('\\', '/'),
        size: statSync(full).size,
      })
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
  const done = new Promise((resolve, reject) => {
    extract.on('finish', resolve)
    extract.on('error', reject)
  })

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

  // Wrap bytes in an array so Readable.from treats it as one chunk;
  // bare `Readable.from(uint8Array)` iterates and yields numbers (0..255).
  Readable.from([Buffer.from(bytes)])
    .pipe(createGunzip())
    .pipe(extract)
  await done
}

function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = []
    stream.on('data', (c) => chunks.push(c))
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', reject)
  })
}
