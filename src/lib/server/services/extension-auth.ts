import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { env } from '$env/dynamic/private'
import {
  approveDeviceAuthorizationAtomic,
  exchangeApprovedDeviceAtomic,
  getAccessContext,
  getRefreshContext,
  insertDeviceAuthorization,
  listExtensionSessions,
  pollDeviceAuthorizationAtomic,
  revokeExtensionSession,
  revokeSessionByAccess,
  revokeSessionByRefresh,
  rotateRefreshAtomic,
  touchSession,
} from '../db/extension-auth.js'
import { passwordVersion } from './auth.js'
import { emitAuditEvent } from './events.js'

const DEVICE_TTL_MS = 10 * 60_000
const ACCESS_TTL_MS = 15 * 60_000
const REFRESH_TTL_MS = 30 * 24 * 60 * 60_000
const USER_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export class ExtensionAuthError extends Error {
  constructor(
    public readonly code:
      | 'invalid_request'
      | 'invalid_token'
      | 'authorization_pending'
      | 'slow_down'
      | 'expired_token'
      | 'access_denied'
      | 'conflict',
    message = code,
  ) {
    super(message)
  }
}

function secret() {
  const value = env.EXTENSION_AUTH_SECRET
  if (!value || value.length < 32) throw new Error('EXTENSION_AUTH_SECRET manquant ou trop court')
  return value
}

export function hashOpaque(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

export function normalizeUserCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z2-9]/g, '')
}

export function hmacUserCode(value: string) {
  return createHmac('sha256', secret()).update(normalizeUserCode(value)).digest('hex')
}

export function pkceChallenge(verifier: string) {
  return createHash('sha256').update(verifier).digest('base64url')
}

function opaque(prefix: string) {
  return `${prefix}_${randomBytes(32).toString('base64url')}`
}

function userCode() {
  const bytes = randomBytes(8)
  const raw = [...bytes]
    .map((byte) => USER_CODE_ALPHABET[byte % USER_CODE_ALPHABET.length])
    .join('')
  return `${raw.slice(0, 4)}-${raw.slice(4)}`
}

function cleanClientName(value: unknown) {
  if (typeof value !== 'string') throw new ExtensionAuthError('invalid_request')
  const clean = value.trim()
  if (
    !clean ||
    clean.length > 100 ||
    [...clean].some((character) => {
      const code = character.charCodeAt(0)
      return code < 32 || code === 127
    })
  )
    throw new ExtensionAuthError('invalid_request')
  return clean
}

function validChallenge(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value)
}

export async function createDeviceAuthorization(input: Record<string, unknown>, now = new Date()) {
  if (input.codeChallengeMethod !== 'S256' || !validChallenge(input.codeChallenge))
    throw new ExtensionAuthError('invalid_request')
  const clientName = cleanClientName(input.clientName)
  const deviceCode = opaque('ldc')
  const displayedCode = userCode()
  await insertDeviceAuthorization({
    id: randomUUID(),
    deviceCodeHash: hashOpaque(deviceCode),
    userCodeHmac: hmacUserCode(displayedCode),
    codeChallenge: input.codeChallenge,
    clientName,
    expiresAt: new Date(now.getTime() + DEVICE_TTL_MS),
    now,
  })
  const base = (env.PUBLIC_APP_URL || '').replace(/\/$/, '')
  if (!/^https?:\/\//.test(base)) throw new Error('PUBLIC_APP_URL invalide')
  return {
    deviceCode,
    userCode: displayedCode,
    verificationUri: `${base}/extensions/authorize`,
    verificationUriComplete: `${base}/extensions/authorize?user_code=${encodeURIComponent(displayedCode)}`,
    expiresIn: DEVICE_TTL_MS / 1000,
    interval: 5,
  }
}

export async function approveDeviceAuthorization(
  input: {
    userCode: unknown
    ludoId: string
    memberId: string
    passwordHash: string
  },
  now = new Date(),
) {
  if (typeof input.userCode !== 'string' || normalizeUserCode(input.userCode).length !== 8)
    throw new ExtensionAuthError('invalid_request')
  const row = await approveDeviceAuthorizationAtomic({
    userCodeHmac: hmacUserCode(input.userCode),
    ludoId: input.ludoId,
    memberId: input.memberId,
    passwordVersion: passwordVersion(input.passwordHash),
    now,
  })
  if (!row) throw new ExtensionAuthError('expired_token')
  await emitAuditEvent({
    action: 'extension.device_approved',
    actorLudoId: input.ludoId,
    actorMemberId: input.memberId,
    entityType: 'extension_device_authorization',
    entityId: row.id,
    metadata: {},
  })
  return { clientName: row.clientName }
}

export async function exchangeDeviceToken(input: Record<string, unknown>, now = new Date()) {
  if (
    typeof input.deviceCode !== 'string' ||
    typeof input.codeVerifier !== 'string' ||
    input.codeVerifier.length < 43 ||
    input.codeVerifier.length > 128 ||
    !/^[A-Za-z0-9._~-]+$/.test(input.codeVerifier)
  )
    throw new ExtensionAuthError('invalid_request')
  const device = await pollDeviceAuthorizationAtomic({
    deviceCodeHash: hashOpaque(input.deviceCode),
    now,
  })
  if (!device) throw new ExtensionAuthError('expired_token')
  if (device.too_fast) throw new ExtensionAuthError('slow_down')
  if (device.status === 'pending') throw new ExtensionAuthError('authorization_pending')
  if (device.status === 'denied') throw new ExtensionAuthError('access_denied')
  if (
    device.status !== 'approved' ||
    !device.ludo_id ||
    !device.member_id ||
    !device.password_version
  )
    throw new ExtensionAuthError('expired_token')
  const actual = Buffer.from(pkceChallenge(input.codeVerifier))
  const expected = Buffer.from(device.code_challenge)
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    throw new ExtensionAuthError('invalid_request')
  const accessToken = opaque('lda')
  const refreshToken = opaque('ldr')
  const accessExpiresAt = new Date(now.getTime() + ACCESS_TTL_MS)
  const refreshExpiresAt = new Date(now.getTime() + REFRESH_TTL_MS)
  const sessionId = randomUUID()
  const row = await exchangeApprovedDeviceAtomic({
    deviceId: device.id,
    ludoId: device.ludo_id,
    memberId: device.member_id,
    label: device.client_name,
    passwordVersion: device.password_version,
    sessionId,
    refreshId: randomUUID(),
    accessTokenHash: hashOpaque(accessToken),
    refreshTokenHash: hashOpaque(refreshToken),
    accessExpiresAt,
    refreshExpiresAt,
    now,
  })
  if (!row) throw new ExtensionAuthError('conflict')
  await emitAuditEvent({
    action: 'extension.session_created',
    actorLudoId: device.ludo_id,
    actorMemberId: device.member_id,
    entityType: 'extension_session',
    entityId: sessionId,
    metadata: {},
  })
  return {
    accessToken,
    tokenType: 'Bearer',
    expiresIn: ACCESS_TTL_MS / 1000,
    refreshToken,
    refreshExpiresIn: REFRESH_TTL_MS / 1000,
  }
}

function validPrincipal(row: {
  passwordVersion: string
  passwordHash: string
  memberRole: string
  memberActive: boolean
  revokedAt?: Date | null
}) {
  return (
    !row.revokedAt &&
    row.memberActive &&
    row.memberRole === 'responsable' &&
    row.passwordVersion === passwordVersion(row.passwordHash)
  )
}

export type ExtensionPrincipal = {
  sessionId: string
  ludoId: string
  memberId: string
  label: string
  ludoName: string
  memberName: string
}

export async function authenticateAccessToken(
  raw: string | null,
  now = new Date(),
): Promise<ExtensionPrincipal> {
  if (!raw?.startsWith('lda_') || raw.length > 200) throw new ExtensionAuthError('invalid_token')
  const row = await getAccessContext(hashOpaque(raw), now)
  if (!row || !validPrincipal(row)) {
    if (row) await revokeSessionByAccess(hashOpaque(raw), now)
    throw new ExtensionAuthError('invalid_token')
  }
  await touchSession(row.sessionId, row.ludoId, now)
  return {
    sessionId: row.sessionId,
    ludoId: row.ludoId,
    memberId: row.memberId,
    label: row.label,
    ludoName: row.ludoName,
    memberName: row.memberName,
  }
}

export async function rotateRefreshToken(input: Record<string, unknown>, now = new Date()) {
  if (
    typeof input.refreshToken !== 'string' ||
    !input.refreshToken.startsWith('ldr_') ||
    input.refreshToken.length > 200
  )
    throw new ExtensionAuthError('invalid_token')
  const tokenHash = hashOpaque(input.refreshToken)
  const context = await getRefreshContext(tokenHash)
  if (!context) throw new ExtensionAuthError('invalid_token')
  if (!validPrincipal(context)) {
    await revokeSessionByRefresh(tokenHash, now)
    throw new ExtensionAuthError('invalid_token')
  }
  const accessToken = opaque('lda')
  const refreshToken = opaque('ldr')
  const row = await rotateRefreshAtomic({
    tokenHash,
    nextId: randomUUID(),
    nextTokenHash: hashOpaque(refreshToken),
    nextAccessTokenHash: hashOpaque(accessToken),
    nextAccessExpiresAt: new Date(now.getTime() + ACCESS_TTL_MS),
    now,
  })
  if (!row || row.outcome === 'replay') throw new ExtensionAuthError('invalid_token')
  return {
    accessToken,
    tokenType: 'Bearer',
    expiresIn: ACCESS_TTL_MS / 1000,
    refreshToken,
    refreshExpiresIn: Math.max(
      0,
      Math.floor((new Date(row.refresh_expires_at).getTime() - now.getTime()) / 1000),
    ),
  }
}

export async function logoutExtension(accessToken: string | null, now = new Date()) {
  if (!accessToken?.startsWith('lda_')) throw new ExtensionAuthError('invalid_token')
  await revokeSessionByAccess(hashOpaque(accessToken), now)
}

export const getExtensionSessions = listExtensionSessions

export async function revokeManagedExtensionSession(
  input: { id: string; ludoId: string; memberId: string },
  now = new Date(),
) {
  const row = await revokeExtensionSession({ ...input, now })
  if (!row) throw new ExtensionAuthError('invalid_request')
  await emitAuditEvent({
    action: 'extension.session_revoked',
    actorLudoId: input.ludoId,
    actorMemberId: input.memberId,
    entityType: 'extension_session',
    entityId: input.id,
    metadata: {},
  })
}
