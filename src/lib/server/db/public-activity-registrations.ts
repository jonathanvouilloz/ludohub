import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from './index.js'
import {
  publicActivities,
  publicActivityRegistrations as registrations,
  type PublicActivityRegistrationInsert,
  type PublicActivityRegistrationStatus,
} from '../schema.js'

export const getPublicActivityRegistrationByIdempotency = (ludoId: string, hash: string) =>
  db.query.publicActivityRegistrations.findFirst({
    where: and(eq(registrations.ludoId, ludoId), eq(registrations.idempotencyKeyHash, hash)),
  })

export type RegistrationAvailabilityRow = {
  enabled: boolean
  capacity: number | null
  occupied: number
}

export async function getPublicActivityRegistrationAvailabilityRow(
  activityId: string,
  ludoId: string,
): Promise<RegistrationAvailabilityRow | undefined> {
  const result = await db.execute<RegistrationAvailabilityRow>(sql`
    SELECT activity.registration_enabled AS enabled,
           activity.registration_capacity AS capacity,
           coalesce(sum(registration.participant_count)
             FILTER (WHERE registration.status IN ('received', 'confirmed')), 0)::int AS occupied
    FROM public_activities AS activity
    LEFT JOIN public_activity_registrations AS registration
      ON registration.activity_id = activity.id AND registration.ludo_id = activity.ludo_id
    WHERE activity.id = ${activityId}::uuid AND activity.ludo_id = ${ludoId}::uuid
    GROUP BY activity.id
  `)
  return result.rows[0]
}

type InsertResult = {
  id: string
  receipt_status: 'received' | 'waitlisted'
  created_at: Date
}

/**
 * Neon exécute `db.batch` dans une transaction wire. Le second statement prend ainsi
 * un nouveau snapshot READ COMMITTED après le verrou, puis inscription et outbox sont
 * écrits atomiquement. Seuls `received` et `confirmed` réservent des places.
 */
export async function insertPublicActivityRegistrationAtomic(
  data: PublicActivityRegistrationInsert & { id: string },
): Promise<InsertResult | undefined> {
  const [, result] = await db.batch([
    db.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${data.ludoId}:${data.activityId}`}::text, 0))`,
    ),
    db.execute<InsertResult>(sql`
    WITH eligible_activity AS MATERIALIZED (
      SELECT activity.id, activity.ludo_id, activity.registration_capacity
      FROM public_activities AS activity
      WHERE activity.id = ${data.activityId}::uuid
        AND activity.ludo_id = ${data.ludoId}::uuid
        AND activity.status = 'published'
        AND activity.lifecycle = 'active'
        AND activity.registration_enabled = true
    ), occupied AS MATERIALIZED (
      SELECT eligible_activity.id,
             coalesce(sum(registration.participant_count)
               FILTER (WHERE registration.status IN ('received', 'confirmed')), 0)::int AS count
      FROM eligible_activity
      LEFT JOIN public_activity_registrations AS registration
        ON registration.activity_id = eligible_activity.id
       AND registration.ludo_id = eligible_activity.ludo_id
      GROUP BY eligible_activity.id
    ), inserted AS (
      INSERT INTO public_activity_registrations (
        id, ludo_id, activity_id, idempotency_key_hash, request_fingerprint, contact_name, email, phone,
        participant_count, message, status, receipt_status, revision, created_at, updated_at
      )
      SELECT ${data.id}::uuid, ${data.ludoId}::uuid, ${data.activityId}::uuid,
             ${data.idempotencyKeyHash}, ${data.requestFingerprint}, ${data.contactName}, ${data.email}, ${data.phone},
             ${data.participantCount}, ${data.message},
             CASE
               WHEN eligible_activity.registration_capacity IS NOT NULL
                AND occupied.count + ${data.participantCount} > eligible_activity.registration_capacity
               THEN 'waitlisted'::public_activity_registration_status
               ELSE 'received'::public_activity_registration_status
             END,
             CASE
               WHEN eligible_activity.registration_capacity IS NOT NULL
                AND occupied.count + ${data.participantCount} > eligible_activity.registration_capacity
               THEN 'waitlisted'::public_activity_registration_status
               ELSE 'received'::public_activity_registration_status
             END,
             1, ${data.createdAt}, ${data.updatedAt}
      FROM eligible_activity JOIN occupied ON occupied.id = eligible_activity.id
      ON CONFLICT (ludo_id, idempotency_key_hash) DO NOTHING
      RETURNING id, ludo_id, email, receipt_status, created_at
    ), queued AS (
      INSERT INTO public_activity_registration_outbox (
        ludo_id, registration_id, kind, recipient_email, status, attempts, created_at, updated_at
      )
      SELECT ludo_id, id, 'receipt', email, 'pending', 0, ${data.createdAt}, ${data.updatedAt}
      FROM inserted
      RETURNING registration_id
    )
    SELECT inserted.id, inserted.receipt_status, inserted.created_at
    FROM inserted JOIN queued ON queued.registration_id = inserted.id
  `),
  ])
  return result.rows[0]
}

export function listPublicActivityRegistrationRows(
  ludoId: string,
  status: PublicActivityRegistrationStatus | undefined,
  activityId: string | undefined,
  limit: number,
) {
  return db.query.publicActivityRegistrations.findMany({
    where: and(
      eq(registrations.ludoId, ludoId),
      status ? eq(registrations.status, status) : undefined,
      activityId ? eq(registrations.activityId, activityId) : undefined,
    ),
    columns: {
      id: true,
      activityId: true,
      contactName: true,
      email: true,
      phone: true,
      participantCount: true,
      message: true,
      status: true,
      revision: true,
      handledAt: true,
      archivedAt: true,
      createdAt: true,
      updatedAt: true,
    },
    with: { activity: { columns: { id: true, title: true, slug: true } } },
    orderBy: [desc(registrations.createdAt), desc(registrations.id)],
    limit,
  })
}

export const getPublicActivityRegistrationRowForLudo = (id: string, ludoId: string) =>
  db.query.publicActivityRegistrations.findFirst({
    where: and(eq(registrations.id, id), eq(registrations.ludoId, ludoId)),
    columns: {
      id: true,
      activityId: true,
      contactName: true,
      email: true,
      phone: true,
      participantCount: true,
      message: true,
      status: true,
      revision: true,
      handledAt: true,
      archivedAt: true,
      createdAt: true,
      updatedAt: true,
    },
    with: { activity: { columns: { id: true, title: true, slug: true } } },
  })

export async function transitionPublicActivityRegistrationRow(
  id: string,
  ludoId: string,
  currentStatus: PublicActivityRegistrationStatus,
  expectedRevision: number,
  data: Pick<
    PublicActivityRegistrationInsert,
    'status' | 'handledByMemberId' | 'handledAt' | 'archivedAt' | 'updatedAt'
  >,
) {
  const [row] = await db
    .update(registrations)
    .set({ ...data, revision: sql`${registrations.revision}+1` })
    .where(
      and(
        eq(registrations.id, id),
        eq(registrations.ludoId, ludoId),
        eq(registrations.status, currentStatus),
        eq(registrations.revision, expectedRevision),
      ),
    )
    .returning()
  return row
}

export async function updatePublicActivityRegistrationSettingsRow(
  activityId: string,
  ludoId: string,
  expectedRevision: number,
  enabled: boolean,
  capacity: number | null,
  memberId: string,
  updatedAt: Date,
) {
  const [row] = await db
    .update(publicActivities)
    .set({
      registrationEnabled: enabled,
      registrationCapacity: capacity,
      updatedByMemberId: memberId,
      updatedAt,
      revision: sql`${publicActivities.revision}+1`,
    })
    .where(
      and(
        eq(publicActivities.id, activityId),
        eq(publicActivities.ludoId, ludoId),
        eq(publicActivities.revision, expectedRevision),
      ),
    )
    .returning()
  return row
}
