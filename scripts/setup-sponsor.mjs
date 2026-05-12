#!/usr/bin/env node
import { privateKeyToAccount } from 'viem/accounts'
import { depositAndApproveSponsor } from '../lib/foc.mjs'

const pk = process.env.DEMO_PK
if (!pk?.startsWith('0x') || pk.length !== 66) {
  console.error('Set DEMO_PK env var (32-byte hex, 0x-prefixed)')
  process.exit(1)
}

const address = privateKeyToAccount(pk).address
const rpcUrl = 'https://api.calibration.node.glif.io/rpc/v1'

const depositAmount = 50n * 10n ** 18n // 50 USDFC
const rateAllowance = 10n ** 17n // 0.1 USDFC / epoch
const lockupAllowance = 10n ** 18n // 1 USDFC max lockup
const maxLockupPeriod = 30n * 24n * 60n * 2n // ~30 days in 30s-epoch units

console.log(`Setting up sponsor wallet ${address} on Calibration...`)
console.log('  Deposit:           50 USDFC')
console.log('  Per-user rate:     0.1 USDFC/epoch')
console.log('  Per-user lockup:   1 USDFC')

const { depositTx, approveTx } = await depositAndApproveSponsor({
  sponsorKey: pk,
  depositAmount,
  rateAllowance,
  lockupAllowance,
  maxLockupPeriod,
  rpcUrl,
})

console.log()
console.log(`✅ Deposit tx:  ${depositTx}`)
console.log(`✅ Approve tx:  ${approveTx}`)
console.log()
console.log('Now hardcode this private key into lib/sponsor.mjs:')
console.log(`  export const SPONSOR_KEY = ${JSON.stringify(pk)}`)
console.log(`  export const SPONSOR_ADDRESS = ${JSON.stringify(address)}`)
