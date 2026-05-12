/**
 * lib/foc.mjs — Thin wrapper around @filoz/synapse-sdk for upload / download /
 * discovery via session keys.
 *
 * Exports:
 *   uploadBundle        – store bytes, return { pieceCid, copies }
 *   downloadBundle      – retrieve bytes by pieceCid
 *   discoverDataSets    – list datasets owned by a session-key address
 *   loginUserSessionKey – one-time on-chain session-key authorisation
 *   depositAndApproveSponsor – operator-level USDFC setup (scripts/setup-sponsor.mjs)
 */

import * as SessionKey from '@filoz/synapse-core/session-key'
import { Synapse, calibration } from '@filoz/synapse-sdk'
import { WarmStorageService } from '@filoz/synapse-sdk/warm-storage'
import { http, createClient, publicActions } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Build a viem wallet client for the root (sponsor) account.
 * Extended with publicActions so it can also read chain state.
 *
 * @param {string} sponsorKey  – 0x-prefixed hex private key
 * @param {string} rpcUrl
 * @returns viem Client
 */
function makeRootClient(sponsorKey, rpcUrl) {
  const account = privateKeyToAccount(sponsorKey)
  return createClient({
    chain: calibration,
    transport: http(rpcUrl),
    account,
  }).extend(publicActions)
}

/**
 * Build a Secp256k1 session key and a Synapse instance for a given user.
 * Syncs expirations from chain before handing back, so Synapse.create can
 * verify the session key has DefaultFwssPermissions.
 *
 * @param {{ sponsorKey: string, sessionPrivateKey: string, rpcUrl: string }}
 * @returns Promise<Synapse>
 */
async function makeSynapseForUser({ sponsorKey, sessionPrivateKey, rpcUrl }) {
  const rootAccount = privateKeyToAccount(sponsorKey)
  const transport = http(rpcUrl)

  const sessionKey = SessionKey.fromSecp256k1({
    privateKey: sessionPrivateKey,
    root: rootAccount,
    chain: calibration,
    transport,
  })

  // Pull on-chain expiration data into the local sessionKey object so that
  // sessionKey.hasPermissions(DefaultFwssPermissions) returns the live truth.
  // The method is on the Secp256k1SessionKey instance itself.
  await sessionKey.syncExpirations()

  return Synapse.create({
    account: rootAccount,
    chain: calibration,
    transport,
    sessionKey,
  })
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Upload a bundle of bytes to Filecoin warm storage.
 * Assumes the session key is already authorised on chain (via loginUserSessionKey).
 *
 * @param {{ bytes: Uint8Array, sponsorKey: string, sessionPrivateKey: string, rpcUrl: string }}
 * @returns Promise<{ pieceCid: string, copies: object[] }>
 */
export async function uploadBundle({ bytes, sponsorKey, sessionPrivateKey, rpcUrl }) {
  const synapse = await makeSynapseForUser({ sponsorKey, sessionPrivateKey, rpcUrl })
  const result = await synapse.storage.upload(bytes)

  if (!result.complete) {
    throw new Error(`Upload incomplete: ${JSON.stringify(result.failedAttempts)}`)
  }

  return { pieceCid: result.pieceCid, copies: result.copies }
}

/**
 * Download a bundle from Filecoin warm storage by its PieceCID.
 *
 * @param {{ pieceCid: string, sponsorKey: string, sessionPrivateKey: string, rpcUrl: string }}
 * @returns Promise<Uint8Array>
 */
export async function downloadBundle({ pieceCid, sponsorKey, sessionPrivateKey, rpcUrl }) {
  const synapse = await makeSynapseForUser({ sponsorKey, sessionPrivateKey, rpcUrl })
  return synapse.storage.download({ pieceCid })
}

/**
 * List all warm-storage datasets owned by a given session-key address.
 * Uses WarmStorageService directly with the root client (read-only).
 *
 * @param {{ sponsorKey: string, sessionAddress: string, rpcUrl: string }}
 * @returns Promise<EnhancedDataSetInfo[]>
 */
export async function discoverDataSets({ sponsorKey, sessionAddress, rpcUrl }) {
  const rootClient = makeRootClient(sponsorKey, rpcUrl)
  const ws = new WarmStorageService({ client: rootClient })
  return ws.getClientDataSetsWithDetails({ address: sessionAddress, onlyManaged: true })
}

/**
 * Perform the one-time on-chain session-key login for a user address.
 * Called by /soul setup (install.mjs) before the user's first upload.
 *
 * @param {{ sponsorKey: string, userSessionAddress: string, rpcUrl: string, expirySeconds?: number }}
 * @returns Promise<string>  transaction hash
 */
export async function loginUserSessionKey({
  sponsorKey,
  userSessionAddress,
  rpcUrl,
  expirySeconds = 365 * 24 * 3600,
}) {
  const rootClient = makeRootClient(sponsorKey, rpcUrl)
  return SessionKey.login(rootClient, {
    address: userSessionAddress,
    expiresAt: BigInt(Math.floor(Date.now() / 1000) + expirySeconds),
  })
}

/**
 * Operator-level setup: deposit USDFC into FilecoinPay and approve the FWSS
 * service contract to spend from it.  Called once by scripts/setup-sponsor.mjs.
 *
 * @param {{ sponsorKey: string, depositAmount: bigint, rateAllowance: bigint,
 *           lockupAllowance: bigint, maxLockupPeriod: bigint, rpcUrl: string }}
 * @returns Promise<{ depositTx: string, approveTx: string }>
 */
export async function depositAndApproveSponsor({
  sponsorKey,
  depositAmount,
  rateAllowance,
  lockupAllowance,
  maxLockupPeriod,
  rpcUrl,
}) {
  const synapse = await Synapse.create({
    account: privateKeyToAccount(sponsorKey),
    chain: calibration,
    transport: http(rpcUrl),
  })

  const depositTx = await synapse.payments.deposit({ token: 'USDFC', amount: depositAmount })
  const approveTx = await synapse.payments.approveService({
    rateAllowance,
    lockupAllowance,
    maxLockupPeriod,
  })

  return { depositTx, approveTx }
}
