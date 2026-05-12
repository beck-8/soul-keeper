#!/usr/bin/env node
import { Synapse } from '@filoz/synapse-sdk'
import { calibration } from '@filoz/synapse-sdk'
import { http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { SPONSOR_KEY } from '../lib/sponsor.mjs'

if (!SPONSOR_KEY) {
  console.error('SPONSOR_KEY is empty in lib/sponsor.mjs — nothing to revoke')
  process.exit(1)
}

const synapse = await Synapse.create({
  account: privateKeyToAccount(SPONSOR_KEY),
  chain: calibration,
  transport: http('https://api.calibration.node.glif.io/rpc/v1'),
})

console.log('Step 1/2: Querying FilecoinPay balance...')
try {
  const balance = await synapse.payments.balance({ token: 'USDFC' })
  console.log(`  Available: ${balance / 10n ** 18n} USDFC`)

  if (balance > 0n) {
    console.log('Step 2/2: Withdrawing all USDFC back to sponsor wallet...')
    const withdrawTx = await synapse.payments.withdraw({ token: 'USDFC', amount: balance })
    console.log(`✅ Withdraw tx: ${withdrawTx}`)
    console.log('   Approved operators can no longer spend.')
  } else {
    console.log('✅ FilecoinPay balance is already 0. Nothing to do.')
  }
} catch (err) {
  console.error(`Query/withdraw failed: ${err.message}`)
  console.error('You may need to manually drain via the FilecoinPay contract.')
  process.exit(1)
}

console.log()
console.log('Manual followup:')
console.log('  1. Transfer remaining USDFC from sponsor wallet to your primary wallet.')
console.log('  2. Transfer remaining FIL out.')
console.log('  3. Remove SPONSOR_KEY from lib/sponsor.mjs (commit the removal).')
