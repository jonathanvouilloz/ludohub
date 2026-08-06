import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { db } from './index.js'
import {
  extensionDeviceAuthorizations as devices,
  extensionRefreshTokens as refreshTokens,
  extensionSessions as sessions,
  ludotheques,
  members,
} from '../schema.js'

export function insertDeviceAuthorization(input: {
  id: string
  deviceCodeHash: string
  userCodeHmac: string
  codeChallenge: string
  clientName: string
  expiresAt: Date
  now: Date
}) {
  return db.insert(devices).values(input).returning({ id: devices.id })
}

export async function approveDeviceAuthorizationAtomic(input: {
  userCodeHmac: string
  ludoId: string
  memberId: string
  passwordVersion: string
  now: Date
}) {
  const [row] = await db
    .update(devices)
    .set({
      status: 'approved',
      ludoId: input.ludoId,
      memberId: input.memberId,
      passwordVersion: input.passwordVersion,
      approvedAt: input.now,
    })
    .where(
      and(
        eq(devices.userCodeHmac, input.userCodeHmac),
        eq(devices.status, 'pending'),
        sql`${devices.expiresAt} > ${input.now}`,
      ),
    )
    .returning({ id: devices.id, clientName: devices.clientName })
  return row
}

export async function pollDeviceAuthorizationAtomic(input: { deviceCodeHash: string; now: Date }) {
  const result = await db.execute<{
    id: string
    status: 'pending' | 'approved' | 'denied' | 'consumed'
    code_challenge: string
    client_name: string
    ludo_id: string | null
    member_id: string | null
    password_version: string | null
    expires_at: Date
    too_fast: boolean
  }>(sql`
    WITH candidate AS MATERIALIZED (
      SELECT id,(last_polled_at IS NOT NULL AND last_polled_at > ${input.now} - interval '5 seconds') AS too_fast
      FROM extension_device_authorizations
      WHERE device_code_hash=${input.deviceCodeHash}
        AND status <> 'consumed' AND expires_at > ${input.now} AND poll_count < 240
      FOR UPDATE
    )
    UPDATE extension_device_authorizations device SET
      poll_count=device.poll_count+1,last_polled_at=${input.now}
    FROM candidate WHERE device.id=candidate.id
    RETURNING device.id,device.status,device.code_challenge,device.client_name,device.ludo_id,
      device.member_id,device.password_version,device.expires_at,candidate.too_fast
  `)
  return result.rows[0]
}

export async function getRefreshContext(tokenHash: string) {
  const [row] = await db
    .select({
      status: refreshTokens.status,
      ludoId: sessions.ludoId,
      memberId: sessions.memberId,
      passwordVersion: sessions.passwordVersion,
      passwordHash: ludotheques.passwordHash,
      memberRole: members.role,
      memberActive: members.isActive,
      revokedAt: sessions.revokedAt,
    })
    .from(refreshTokens)
    .innerJoin(
      sessions,
      and(eq(sessions.id, refreshTokens.sessionId), eq(sessions.ludoId, refreshTokens.ludoId)),
    )
    .innerJoin(ludotheques, eq(ludotheques.id, sessions.ludoId))
    .innerJoin(members, and(eq(members.id, sessions.memberId), eq(members.ludoId, sessions.ludoId)))
    .where(eq(refreshTokens.tokenHash, tokenHash))
  return row
}

export async function exchangeApprovedDeviceAtomic(input: {
  deviceId: string
  ludoId: string
  memberId: string
  label: string
  passwordVersion: string
  sessionId: string
  refreshId: string
  accessTokenHash: string
  refreshTokenHash: string
  accessExpiresAt: Date
  refreshExpiresAt: Date
  now: Date
}) {
  const result = await db.execute<{ session_id: string }>(sql`
    WITH consumed AS (
      UPDATE extension_device_authorizations SET status='consumed',consumed_at=${input.now}
      WHERE id=${input.deviceId}::uuid AND status='approved' AND expires_at > ${input.now}
        AND ludo_id=${input.ludoId}::uuid AND member_id=${input.memberId}::uuid
        AND password_version=${input.passwordVersion}
      RETURNING id
    ), inserted_session AS (
      INSERT INTO extension_sessions
        (id,ludo_id,member_id,label,password_version,access_token_hash,access_expires_at,
         refresh_expires_at,created_at,last_used_at)
      SELECT ${input.sessionId}::uuid,${input.ludoId}::uuid,${input.memberId}::uuid,
        ${input.label},${input.passwordVersion},${input.accessTokenHash},${input.accessExpiresAt},
        ${input.refreshExpiresAt},${input.now},${input.now}
      FROM consumed RETURNING id,ludo_id
    ), inserted_refresh AS (
      INSERT INTO extension_refresh_tokens
        (id,session_id,ludo_id,token_hash,generation,status,expires_at,created_at)
      SELECT ${input.refreshId}::uuid,id,ludo_id,${input.refreshTokenHash},0,'active',
        ${input.refreshExpiresAt},${input.now} FROM inserted_session
      RETURNING session_id
    ) SELECT session_id FROM inserted_refresh
  `)
  return result.rows[0]
}

export async function getAccessContext(accessTokenHash: string, now: Date) {
  const [row] = await db
    .select({
      sessionId: sessions.id,
      ludoId: sessions.ludoId,
      memberId: sessions.memberId,
      label: sessions.label,
      ludoName: ludotheques.name,
      memberName: members.name,
      passwordVersion: sessions.passwordVersion,
      passwordHash: ludotheques.passwordHash,
      memberRole: members.role,
      memberActive: members.isActive,
      accessExpiresAt: sessions.accessExpiresAt,
      refreshExpiresAt: sessions.refreshExpiresAt,
      createdAt: sessions.createdAt,
    })
    .from(sessions)
    .innerJoin(ludotheques, eq(ludotheques.id, sessions.ludoId))
    .innerJoin(members, and(eq(members.id, sessions.memberId), eq(members.ludoId, sessions.ludoId)))
    .where(
      and(
        eq(sessions.accessTokenHash, accessTokenHash),
        isNull(sessions.revokedAt),
        sql`${sessions.accessExpiresAt} > ${now}`,
      ),
    )
  return row
}

export async function touchSession(sessionId: string, ludoId: string, now: Date) {
  await db
    .update(sessions)
    .set({ lastUsedAt: now })
    .where(and(eq(sessions.id, sessionId), eq(sessions.ludoId, ludoId)))
}

export async function rotateRefreshAtomic(input: {
  tokenHash: string
  nextId: string
  nextTokenHash: string
  nextAccessTokenHash: string
  nextAccessExpiresAt: Date
  now: Date
}) {
  const result = await db.execute<{
    outcome: 'rotated' | 'replay'
    session_id: string
    ludo_id: string
    member_id: string
    password_version: string
    generation: number
    refresh_expires_at: Date
  }>(sql`
    WITH candidate AS MATERIALIZED (
      SELECT token.*, session.member_id,session.password_version,session.refresh_expires_at,
             session.revoked_at
      FROM extension_refresh_tokens token
      JOIN extension_sessions session ON session.id=token.session_id AND session.ludo_id=token.ludo_id
      WHERE token.token_hash=${input.tokenHash}
      FOR UPDATE OF token,session
    ), replay_revocation AS (
      UPDATE extension_sessions session SET revoked_at=${input.now}
      FROM candidate WHERE session.id=candidate.session_id AND session.ludo_id=candidate.ludo_id
        AND candidate.status <> 'active' AND session.revoked_at IS NULL
      RETURNING session.id,session.ludo_id,session.member_id,session.password_version,
        candidate.generation,session.refresh_expires_at
    ), revoked_tokens AS (
      UPDATE extension_refresh_tokens token SET status='revoked',used_at=coalesce(token.used_at,${input.now})
      FROM replay_revocation revoked WHERE token.session_id=revoked.id AND token.ludo_id=revoked.ludo_id
        AND token.status='active' RETURNING token.id
    ), used AS (
      UPDATE extension_refresh_tokens token SET status='used',used_at=${input.now}
      FROM candidate WHERE token.id=candidate.id AND candidate.status='active'
        AND candidate.expires_at > ${input.now} AND candidate.refresh_expires_at > ${input.now}
        AND candidate.revoked_at IS NULL
      RETURNING token.session_id,token.ludo_id,token.generation
    ), updated_session AS (
      UPDATE extension_sessions session SET access_token_hash=${input.nextAccessTokenHash},
        access_expires_at=${input.nextAccessExpiresAt},last_used_at=${input.now}
      FROM used WHERE session.id=used.session_id AND session.ludo_id=used.ludo_id
      RETURNING session.id,session.ludo_id,session.member_id,session.password_version,
        session.refresh_expires_at,used.generation
    ), inserted AS (
      INSERT INTO extension_refresh_tokens
        (id,session_id,ludo_id,token_hash,generation,status,expires_at,created_at)
      SELECT ${input.nextId}::uuid,id,ludo_id,${input.nextTokenHash},generation+1,'active',
        refresh_expires_at,${input.now} FROM updated_session
      RETURNING session_id,ludo_id,generation
    )
    SELECT 'rotated'::text AS outcome,updated_session.id AS session_id,updated_session.ludo_id,
      updated_session.member_id,updated_session.password_version,inserted.generation,
      updated_session.refresh_expires_at FROM updated_session JOIN inserted ON inserted.session_id=updated_session.id
    UNION ALL
    SELECT 'replay'::text,replay_revocation.id,replay_revocation.ludo_id,replay_revocation.member_id,
      replay_revocation.password_version,replay_revocation.generation,replay_revocation.refresh_expires_at
    FROM replay_revocation
  `)
  return result.rows[0]
}

export async function revokeSessionByAccess(accessTokenHash: string, now: Date) {
  const result = await db.execute<{ id: string }>(sql`
    WITH revoked AS (
      UPDATE extension_sessions SET revoked_at=${now}
      WHERE access_token_hash=${accessTokenHash} AND revoked_at IS NULL RETURNING id,ludo_id
    ), tokens AS (
      UPDATE extension_refresh_tokens token SET status='revoked',used_at=coalesce(used_at,${now})
      FROM revoked WHERE token.session_id=revoked.id AND token.ludo_id=revoked.ludo_id
        AND token.status='active' RETURNING token.id
    ) SELECT id FROM revoked
  `)
  return result.rows[0]
}

export async function revokeSessionByRefresh(refreshTokenHash: string, now: Date) {
  const result = await db.execute<{ id: string }>(sql`
    WITH candidate AS (
      SELECT session_id,ludo_id FROM extension_refresh_tokens WHERE token_hash=${refreshTokenHash}
    ), revoked AS (
      UPDATE extension_sessions session SET revoked_at=coalesce(session.revoked_at,${now})
      FROM candidate WHERE session.id=candidate.session_id AND session.ludo_id=candidate.ludo_id
      RETURNING session.id,session.ludo_id
    ), tokens AS (
      UPDATE extension_refresh_tokens token SET status='revoked',used_at=coalesce(used_at,${now})
      FROM revoked WHERE token.session_id=revoked.id AND token.ludo_id=revoked.ludo_id
        AND token.status='active' RETURNING token.id
    ) SELECT id FROM revoked
  `)
  return result.rows[0]
}

export function listExtensionSessions(ludoId: string) {
  return db
    .select({
      id: sessions.id,
      label: sessions.label,
      createdAt: sessions.createdAt,
      lastUsedAt: sessions.lastUsedAt,
      accessExpiresAt: sessions.accessExpiresAt,
      refreshExpiresAt: sessions.refreshExpiresAt,
    })
    .from(sessions)
    .where(and(eq(sessions.ludoId, ludoId), isNull(sessions.revokedAt)))
    .orderBy(desc(sessions.createdAt))
}

export async function revokeExtensionSession(input: {
  id: string
  ludoId: string
  memberId: string
  now: Date
}) {
  const result = await db.execute<{ id: string }>(sql`
    WITH revoked AS (
      UPDATE extension_sessions SET revoked_at=${input.now},revoked_by_member_id=${input.memberId}::uuid
      WHERE id=${input.id}::uuid AND ludo_id=${input.ludoId}::uuid AND revoked_at IS NULL
      RETURNING id,ludo_id
    ), tokens AS (
      UPDATE extension_refresh_tokens token SET status='revoked',used_at=coalesce(used_at,${input.now})
      FROM revoked WHERE token.session_id=revoked.id AND token.ludo_id=revoked.ludo_id
        AND token.status='active' RETURNING token.id
    ) SELECT id FROM revoked
  `)
  return result.rows[0]
}
