// 0xDEMO sponsor — populated by `scripts/setup-sponsor.mjs` before demo.
// Leave empty in repo; runtime fallback prompts user to BYOK or contact author.
export const SPONSOR_KEY = ''
export const SPONSOR_ADDRESS = ''

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
