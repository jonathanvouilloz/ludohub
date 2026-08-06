import { beforeEach, describe, expect, it, vi } from 'vitest'

const env = vi.hoisted(() => ({
  EXTENSION_AUTH_SECRET: 'x'.repeat(48),
  PUBLIC_APP_URL: 'https://app.test',
}))
const audit = vi.hoisted(() => vi.fn())
const store = vi.hoisted(() => ({
  insertDevice: vi.fn(),
  approve: vi.fn(),
  poll: vi.fn(),
  exchange: vi.fn(),
  access: vi.fn(),
  touch: vi.fn(),
  refreshContext: vi.fn(),
  rotate: vi.fn(),
  revokeAccess: vi.fn(),
  revokeRefresh: vi.fn(),
  list: vi.fn(),
  revokeManaged: vi.fn(),
}))
vi.mock('$env/dynamic/private', () => ({ env }))
vi.mock('./auth.js', () => ({ passwordVersion: (value: string) => `pv:${value}` }))
vi.mock('./events.js', () => ({ emitAuditEvent: audit }))
vi.mock('../db/extension-auth.js', () => ({
  insertDeviceAuthorization: store.insertDevice,
  approveDeviceAuthorizationAtomic: store.approve,
  pollDeviceAuthorizationAtomic: store.poll,
  exchangeApprovedDeviceAtomic: store.exchange,
  getAccessContext: store.access,
  touchSession: store.touch,
  getRefreshContext: store.refreshContext,
  rotateRefreshAtomic: store.rotate,
  revokeSessionByAccess: store.revokeAccess,
  revokeSessionByRefresh: store.revokeRefresh,
  listExtensionSessions: store.list,
  revokeExtensionSession: store.revokeManaged,
}))

import {
  approveDeviceAuthorization,
  authenticateAccessToken,
  createDeviceAuthorization,
  exchangeDeviceToken,
  hashOpaque,
  hmacUserCode,
  pkceChallenge,
  rotateRefreshToken,
} from './extension-auth.js'
import { passwordVersion } from './auth.js'

const LUDO = '10000000-0000-4000-8000-000000000001'
const MEMBER = '20000000-0000-4000-8000-000000000001'
const SESSION = '30000000-0000-4000-8000-000000000001'
const DEVICE = '40000000-0000-4000-8000-000000000001'
const VERIFIER = 'a'.repeat(43)
const HASH = 'stored-password-hash'

beforeEach(() => {
  vi.clearAllMocks()
  store.insertDevice.mockResolvedValue([{ id: DEVICE }])
})

describe('device authorization + PKCE', () => {
  it('n’enregistre que les empreintes et renvoie un code court de dix minutes', async () => {
    const result = await createDeviceAuthorization(
      {
        clientName: 'Poste accueil',
        codeChallengeMethod: 'S256',
        codeChallenge: pkceChallenge(VERIFIER),
      },
      new Date('2026-08-06T10:00:00Z'),
    )
    expect(result).toMatchObject({
      userCode: expect.stringMatching(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/),
      expiresIn: 600,
      interval: 5,
      verificationUri: 'https://app.test/extensions/authorize',
    })
    expect(result.deviceCode).toMatch(/^ldc_/)
    expect(store.insertDevice).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceCodeHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        userCodeHmac: expect.stringMatching(/^[a-f0-9]{64}$/),
        codeChallenge: pkceChallenge(VERIFIER),
      }),
    )
    expect(JSON.stringify(store.insertDevice.mock.calls)).not.toContain(result.deviceCode)
    expect(JSON.stringify(store.insertDevice.mock.calls)).not.toContain(result.userCode)
  })

  it.each([
    { codeChallengeMethod: 'plain', codeChallenge: pkceChallenge(VERIFIER) },
    { codeChallengeMethod: 'S256', codeChallenge: 'court' },
  ])('refuse tout PKCE autre que S256', async (input) => {
    await expect(
      createDeviceAuthorization({ clientName: 'Poste', ...input }),
    ).rejects.toMatchObject({ code: 'invalid_request' })
  })

  it('lie le code HMAC à la session web responsable sans auditer le code', async () => {
    store.approve.mockResolvedValue({ id: DEVICE, clientName: 'Poste' })
    await approveDeviceAuthorization({
      userCode: 'ABCD-EFGH',
      ludoId: LUDO,
      memberId: MEMBER,
      passwordHash: HASH,
    })
    expect(store.approve).toHaveBeenCalledWith(
      expect.objectContaining({
        userCodeHmac: hmacUserCode('ABCDEFGH'),
        ludoId: LUDO,
        memberId: MEMBER,
        passwordVersion: passwordVersion(HASH),
      }),
    )
    expect(JSON.stringify(audit.mock.calls)).not.toMatch(/ABCD|Poste/)
  })

  it.each([
    ['pending', 'authorization_pending'],
    ['denied', 'access_denied'],
  ])('rend l’état OAuth %s sans créer de session', async (status, code) => {
    store.poll.mockResolvedValue({
      id: DEVICE,
      status,
      too_fast: false,
      code_challenge: pkceChallenge(VERIFIER),
    })
    await expect(
      exchangeDeviceToken({ deviceCode: 'ldc_x', codeVerifier: VERIFIER }),
    ).rejects.toMatchObject({ code })
    expect(store.exchange).not.toHaveBeenCalled()
  })

  it('applique le polling minimal en base', async () => {
    store.poll.mockResolvedValue({ id: DEVICE, status: 'pending', too_fast: true })
    await expect(
      exchangeDeviceToken({ deviceCode: 'ldc_x', codeVerifier: VERIFIER }),
    ).rejects.toMatchObject({ code: 'slow_down' })
  })

  it('refuse un verifier PKCE incorrect puis échange une seule fois atomiquement', async () => {
    const approved = {
      id: DEVICE,
      status: 'approved',
      too_fast: false,
      code_challenge: pkceChallenge(VERIFIER),
      client_name: 'Poste',
      ludo_id: LUDO,
      member_id: MEMBER,
      password_version: passwordVersion(HASH),
    }
    store.poll.mockResolvedValue(approved)
    await expect(
      exchangeDeviceToken({ deviceCode: 'ldc_x', codeVerifier: 'b'.repeat(43) }),
    ).rejects.toMatchObject({ code: 'invalid_request' })
    store.exchange.mockResolvedValue({ session_id: SESSION })
    const result = await exchangeDeviceToken({ deviceCode: 'ldc_x', codeVerifier: VERIFIER })
    expect(result).toMatchObject({
      accessToken: expect.stringMatching(/^lda_/),
      refreshToken: expect.stringMatching(/^ldr_/),
      expiresIn: 900,
      refreshExpiresIn: 2592000,
    })
    expect(store.exchange).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: DEVICE,
        ludoId: LUDO,
        memberId: MEMBER,
        accessTokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        refreshTokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    )
  })
})

describe('sessions Bearer et rotation', () => {
  const accessRow = {
    sessionId: SESSION,
    ludoId: LUDO,
    memberId: MEMBER,
    label: 'Poste',
    ludoName: 'Ludothèque test',
    memberName: 'Responsable test',
    passwordVersion: passwordVersion(HASH),
    passwordHash: HASH,
    memberRole: 'responsable',
    memberActive: true,
    revokedAt: null,
  }
  it('tire tenant, membre et rôle uniquement du token opaque', async () => {
    store.access.mockResolvedValue(accessRow)
    await expect(authenticateAccessToken('lda_secret')).resolves.toEqual({
      sessionId: SESSION,
      ludoId: LUDO,
      memberId: MEMBER,
      label: 'Poste',
      ludoName: 'Ludothèque test',
      memberName: 'Responsable test',
    })
    expect(store.access).toHaveBeenCalledWith(hashOpaque('lda_secret'), expect.any(Date))
  })

  it.each([{ memberActive: false }, { memberRole: 'member' }, { passwordVersion: 'old' }])(
    'révoque un principal devenu invalide',
    async (override) => {
      store.access.mockResolvedValue({ ...accessRow, ...override })
      await expect(authenticateAccessToken('lda_secret')).rejects.toMatchObject({
        code: 'invalid_token',
      })
      expect(store.revokeAccess).toHaveBeenCalled()
    },
  )

  it('fait tourner refresh et access sans prolonger la famille de trente jours', async () => {
    store.refreshContext.mockResolvedValue(accessRow)
    store.rotate.mockResolvedValue({
      outcome: 'rotated',
      refresh_expires_at: new Date(Date.now() + 1_000_000),
    })
    const result = await rotateRefreshToken({ refreshToken: 'ldr_secret' })
    expect(result.accessToken).toMatch(/^lda_/)
    expect(result.refreshToken).toMatch(/^ldr_/)
    expect(store.rotate).toHaveBeenCalledWith(
      expect.objectContaining({
        tokenHash: hashOpaque('ldr_secret'),
        nextAccessTokenHash: expect.any(String),
        nextTokenHash: expect.any(String),
      }),
    )
  })

  it('rejette le rejeu signalé atomiquement par la base', async () => {
    store.refreshContext.mockResolvedValue({ ...accessRow, status: 'used' })
    store.rotate.mockResolvedValue({ outcome: 'replay' })
    await expect(rotateRefreshToken({ refreshToken: 'ldr_secret' })).rejects.toMatchObject({
      code: 'invalid_token',
    })
  })
})
