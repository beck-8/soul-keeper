// 0xDEMO sponsor — Calibration testnet throwaway key for Mu demo.
// ⚠ POC ONLY — never reuse this key, never use on mainnet, drain after demo via scripts/revoke-all.mjs.
export const SPONSOR_KEY = '0x3c00183253f4f7fd47da9b9906de5da7d93b7f7faced878f80a571b608e68860'
export const SPONSOR_ADDRESS = '0xad5c36d1e7d0a5698144215c88379D09e10a9cb5'

// USDFC has 18 decimals; helper constructs bigint amounts from decimal values.
const USDFC = (n) => BigInt(Math.floor(n * 1e6)) * 10n ** 12n

export const SPONSOR_LIMITS = {
  rateAllowance: USDFC(0.1), // 0.1 USDFC per month per user
  lockupAllowance: USDFC(1.0), // 1 USDFC total lockup per user
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
