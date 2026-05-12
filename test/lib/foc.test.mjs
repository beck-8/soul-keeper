import { beforeEach, describe, expect, it, vi } from 'vitest'

const uploadMock = vi.fn().mockResolvedValue({
  complete: true,
  copies: [{ providerId: 'sp1', dataSetId: 42n, pieceId: 7n, role: 'primary' }],
  failedAttempts: [],
  pieceCid: 'baga6ea4seaqfake',
})
const downloadMock = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]))
const approveServiceMock = vi.fn().mockResolvedValue('0xapproveTxHash')
const depositMock = vi.fn().mockResolvedValue('0xdepositTxHash')

const synapseCreateMock = vi.fn().mockResolvedValue({
  storage: { upload: uploadMock, download: downloadMock },
  payments: { approveService: approveServiceMock, deposit: depositMock },
})

vi.mock('@filoz/synapse-sdk', () => ({
  Synapse: { create: synapseCreateMock },
  calibration: { id: 314159, name: 'Calibration' },
}))

vi.mock('@filoz/synapse-sdk/warm-storage', () => ({
  WarmStorageService: vi.fn().mockImplementation(() => ({
    getClientDataSetsWithDetails: vi
      .fn()
      .mockResolvedValue([{ dataSetId: 42n, pdpEndPoint: 'https://sp.example' }]),
  })),
}))

const loginSyncMock = vi.fn().mockResolvedValue({
  receipt: { transactionHash: '0xloginTxHash' },
  event: { args: {} },
})
vi.mock('@filoz/synapse-core/session-key', () => ({
  fromSecp256k1: vi.fn().mockReturnValue({
    client: { account: { address: '0xUSER' } },
    hasPermissions: () => true,
    syncExpirations: vi.fn().mockResolvedValue(undefined),
  }),
  login: vi.fn().mockResolvedValue('0xloginTxHash'),
  loginSync: loginSyncMock,
}))

vi.mock('viem/accounts', () => ({
  privateKeyToAccount: vi.fn().mockReturnValue({
    address: '0xSPONSOR',
    type: 'local',
  }),
}))

vi.mock('viem', () => ({
  http: vi.fn().mockReturnValue({ type: 'http' }),
  createClient: vi.fn().mockReturnValue({
    chain: { id: 314159 },
    transport: { type: 'http' },
    account: { address: '0xSPONSOR' },
    extend: vi.fn().mockReturnValue({
      chain: { id: 314159 },
      transport: { type: 'http' },
      account: { address: '0xSPONSOR' },
    }),
  }),
  publicActions: {},
}))

beforeEach(() => vi.clearAllMocks())

describe('lib/foc', () => {
  it('uploadBundle returns a PieceCID', async () => {
    const { uploadBundle } = await import('../../lib/foc.mjs')
    const result = await uploadBundle({
      bytes: new Uint8Array([9, 9, 9]),
      sponsorKey: `0x${'11'.repeat(32)}`,
      sessionPrivateKey: `0x${'22'.repeat(32)}`,
      rpcUrl: 'https://rpc.example',
    })
    expect(result.pieceCid).toBe('baga6ea4seaqfake')
    expect(uploadMock).toHaveBeenCalledOnce()
  })

  it('downloadBundle returns bytes', async () => {
    const { downloadBundle } = await import('../../lib/foc.mjs')
    const out = await downloadBundle({
      pieceCid: 'baga6ea4seaqfake',
      sponsorKey: `0x${'11'.repeat(32)}`,
      sessionPrivateKey: `0x${'22'.repeat(32)}`,
      rpcUrl: 'https://rpc.example',
    })
    expect(out).toEqual(new Uint8Array([1, 2, 3]))
  })

  it('discoverDataSets returns owned datasets for the user address', async () => {
    const { discoverDataSets } = await import('../../lib/foc.mjs')
    const sets = await discoverDataSets({
      sponsorKey: `0x${'11'.repeat(32)}`,
      sessionAddress: '0xUSER',
      rpcUrl: 'https://rpc.example',
    })
    expect(sets).toHaveLength(1)
    expect(sets[0].dataSetId).toBe(42n)
  })

  it('uploadBundle throws when result.complete is false', async () => {
    uploadMock.mockResolvedValueOnce({
      complete: false,
      copies: [],
      failedAttempts: [{ providerId: 'sp1', error: 'rejected', role: 'primary' }],
      pieceCid: undefined,
    })
    const { uploadBundle } = await import('../../lib/foc.mjs')
    await expect(
      uploadBundle({
        bytes: new Uint8Array([1]),
        sponsorKey: `0x${'11'.repeat(32)}`,
        sessionPrivateKey: `0x${'22'.repeat(32)}`,
        rpcUrl: 'https://rpc.example',
      }),
    ).rejects.toThrow(/upload/i)
  })

  it('self-heals missing session-key permissions by calling loginSync then retrying', async () => {
    synapseCreateMock
      .mockRejectedValueOnce(
        new Error(
          'Session key does not have the required permissions. Please login and sync expirations with the session key first.',
        ),
      )
      .mockResolvedValueOnce({
        storage: { upload: uploadMock, download: downloadMock },
        payments: { approveService: approveServiceMock, deposit: depositMock },
      })

    const { uploadBundle } = await import('../../lib/foc.mjs')
    const result = await uploadBundle({
      bytes: new Uint8Array([1, 2]),
      sponsorKey: `0x${'11'.repeat(32)}`,
      sessionPrivateKey: `0x${'22'.repeat(32)}`,
      rpcUrl: 'https://rpc.example',
    })

    expect(result.pieceCid).toBe('baga6ea4seaqfake')
    expect(loginSyncMock).toHaveBeenCalledOnce()
    expect(synapseCreateMock).toHaveBeenCalledTimes(2)
  })

  it('does not infinite-loop if Synapse.create keeps rejecting with permissions error', async () => {
    // mockRejectedValueOnce x2 — first attempt + retry-after-login both fail.
    // Use Once so the persistent default mock state isn't polluted for later tests.
    synapseCreateMock
      .mockRejectedValueOnce(new Error('Session key does not have the required permissions.'))
      .mockRejectedValueOnce(new Error('Session key does not have the required permissions.'))
    const { uploadBundle } = await import('../../lib/foc.mjs')
    await expect(
      uploadBundle({
        bytes: new Uint8Array([1]),
        sponsorKey: `0x${'11'.repeat(32)}`,
        sessionPrivateKey: `0x${'22'.repeat(32)}`,
        rpcUrl: 'https://rpc.example',
      }),
    ).rejects.toThrow(/permissions/i)
    expect(synapseCreateMock).toHaveBeenCalledTimes(2) // one initial, one after login
  })

  it('depositAndApproveSponsor returns both tx hashes', async () => {
    const { depositAndApproveSponsor } = await import('../../lib/foc.mjs')
    const result = await depositAndApproveSponsor({
      sponsorKey: `0x${'11'.repeat(32)}`,
      depositAmount: 50n * 10n ** 18n,
      rateAllowance: 100000n,
      lockupAllowance: 1000000n,
      maxLockupPeriod: 86400n,
      rpcUrl: 'https://rpc.example',
    })
    expect(result.depositTx).toBe('0xdepositTxHash')
    expect(result.approveTx).toBe('0xapproveTxHash')
    expect(depositMock).toHaveBeenCalledOnce()
    expect(approveServiceMock).toHaveBeenCalledOnce()
  })
})
