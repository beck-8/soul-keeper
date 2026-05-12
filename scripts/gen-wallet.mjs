#!/usr/bin/env node
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

const pk = generatePrivateKey()
const account = privateKeyToAccount(pk)

console.log('Private key:', pk)
console.log('Address:    ', account.address)
console.log()
console.log('⚠ Save the private key in a password manager.')
console.log('⚠ Never commit it. Use only on Calibration testnet.')
