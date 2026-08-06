import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { db } from './index.js'
import {
  familyRegistrationForms as forms,
  familyRegistrationSubmissionMembers as submissionMembers,
  familyRegistrationSubmissions as submissions,
  type FamilyRegistrationGender,
  type FamilyRegistrationDocumentKind,
  type FamilyRegistrationPaymentMethod,
  type FamilyRegistrationSubmissionStatus,
} from '../schema.js'

export const getFamilyRegistrationFormForLudo = (ludoId: string) =>
  db.query.familyRegistrationForms.findFirst({ where: eq(forms.ludoId, ludoId) })

export const getFamilySubmissionReceiptByKey = (ludoId: string, keyHash: string) =>
  db.query.familySubmissionReceipts.findFirst({
    where: (receipt, { and, eq }) =>
      and(eq(receipt.ludoId, ludoId), eq(receipt.idempotencyKeyHash, keyHash)),
  })

export async function createFamilyRegistrationFormRow(input: {
  id: string
  ludoId: string
  title: string
  memberId: string
  now: Date
}) {
  const [row] = await db
    .insert(forms)
    .values({
      id: input.id,
      ludoId: input.ludoId,
      title: input.title,
      intro: null,
      consentLabel: null,
      enabled: false,
      maxMembers: 20,
      retentionDays: 30,
      annualFeeCents: 3000,
      currency: 'CHF',
      allowsTwint: true,
      allowsCash: true,
      revision: 1,
      updatedByMemberId: input.memberId,
      createdAt: input.now,
      updatedAt: input.now,
    })
    .onConflictDoNothing({ target: [forms.ludoId, forms.slug] })
    .returning()
  return row
}

export async function updateFamilyRegistrationFormRow(input: {
  id: string
  ludoId: string
  expectedRevision: number
  title: string
  intro: string | null
  consentLabel: string | null
  enabled: boolean
  maxMembers: number
  retentionDays: number
  annualFeeCents: number
  allowsTwint: boolean
  allowsCash: boolean
  memberId: string
  now: Date
}) {
  const [row] = await db
    .update(forms)
    .set({
      title: input.title,
      intro: input.intro,
      consentLabel: input.consentLabel,
      enabled: input.enabled,
      maxMembers: input.maxMembers,
      retentionDays: input.retentionDays,
      annualFeeCents: input.annualFeeCents,
      currency: 'CHF',
      allowsTwint: input.allowsTwint,
      allowsCash: input.allowsCash,
      updatedByMemberId: input.memberId,
      updatedAt: input.now,
      revision: sql`${forms.revision}+1`,
    })
    .where(
      and(
        eq(forms.id, input.id),
        eq(forms.ludoId, input.ludoId),
        eq(forms.revision, input.expectedRevision),
      ),
    )
    .returning()
  return row
}

export type FamilyDocumentManagementRow = {
  id: string
  slug: string
  title: string
  kind: FamilyRegistrationDocumentKind
  requiredAcceptance: boolean
  sort_order: number
  revision: number
  version: number | null
  content_markdown: string | null
  sha256: string | null
  created_at: Date | null
}

export async function listFamilyDocumentRows(ludoId: string, formId: string) {
  const result = await db.execute<FamilyDocumentManagementRow>(sql`
    SELECT document.id, document.slug, document.title, document.kind,
           document.required_acceptance AS "requiredAcceptance", document.sort_order,
           document.revision, version.version, version.content_markdown,
           version.sha256, version.created_at
    FROM family_registration_documents AS document
    LEFT JOIN LATERAL (
      SELECT candidate.version, candidate.content_markdown, candidate.sha256, candidate.created_at
      FROM family_registration_document_versions AS candidate
      WHERE candidate.document_id = document.id AND candidate.ludo_id = document.ludo_id
      ORDER BY candidate.version DESC LIMIT 1
    ) AS version ON true
    WHERE document.ludo_id = ${ludoId}::uuid AND document.form_id = ${formId}::uuid
    ORDER BY document.sort_order, document.id
  `)
  return result.rows
}

export async function createFamilyDocumentAtomic(input: {
  id: string
  versionId: string
  ludoId: string
  formId: string
  slug: string
  title: string
  kind: FamilyRegistrationDocumentKind
  requiredAcceptance: boolean
  sortOrder: number
  contentMarkdown: string
  sha256: string
  memberId: string
  now: Date
}) {
  const result = await db.execute<{ id: string }>(sql`
    WITH inserted_document AS (
      INSERT INTO family_registration_documents
        (id,ludo_id,form_id,slug,title,kind,required_acceptance,sort_order,revision,created_at,updated_at)
      VALUES (${input.id}::uuid,${input.ludoId}::uuid,${input.formId}::uuid,${input.slug},
              ${input.title},${input.kind},${input.requiredAcceptance},${input.sortOrder},1,${input.now},${input.now})
      RETURNING id,ludo_id
    ), inserted_version AS (
      INSERT INTO family_registration_document_versions
        (id,ludo_id,document_id,version,title,kind,required_acceptance,content_markdown,sha256,created_by_member_id,created_at)
      SELECT ${input.versionId}::uuid,ludo_id,id,1,${input.title},${input.kind},${input.requiredAcceptance},${input.contentMarkdown},${input.sha256},
             ${input.memberId}::uuid,${input.now} FROM inserted_document
      RETURNING document_id
    ) SELECT document_id AS id FROM inserted_version
  `)
  return result.rows[0]
}

export async function versionFamilyDocumentAtomic(input: {
  id: string
  versionId: string
  ludoId: string
  expectedRevision: number
  title: string
  kind: FamilyRegistrationDocumentKind
  requiredAcceptance: boolean
  sortOrder: number
  contentMarkdown: string
  sha256: string
  memberId: string
  now: Date
}) {
  const result = await db.execute<{ id: string }>(sql`
    WITH updated AS (
      UPDATE family_registration_documents
      SET title=${input.title},kind=${input.kind},required_acceptance=${input.requiredAcceptance},sort_order=${input.sortOrder},revision=revision+1,updated_at=${input.now}
      WHERE id=${input.id}::uuid AND ludo_id=${input.ludoId}::uuid
        AND revision=${input.expectedRevision}
      RETURNING id,ludo_id
    ), inserted AS (
      INSERT INTO family_registration_document_versions
        (id,ludo_id,document_id,version,title,kind,required_acceptance,content_markdown,sha256,created_by_member_id,created_at)
      SELECT ${input.versionId}::uuid,updated.ludo_id,updated.id,
             coalesce(max(previous.version),0)+1,${input.title},${input.kind},${input.requiredAcceptance},${input.contentMarkdown},${input.sha256},
             ${input.memberId}::uuid,${input.now}
      FROM updated LEFT JOIN family_registration_document_versions previous
        ON previous.document_id=updated.id AND previous.ludo_id=updated.ludo_id
      GROUP BY updated.id,updated.ludo_id
      RETURNING document_id
    ) SELECT document_id AS id FROM inserted
  `)
  return result.rows[0]
}

export async function publishFamilyFormAtomic(input: {
  formId: string
  versionId: string
  ludoId: string
  expectedRevision: number
  memberId: string
  now: Date
}) {
  const [, result] = await db.batch([
    db.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${input.ludoId}:${input.formId}`}::text,0))`,
    ),
    db.execute<{ id: string; version: number }>(sql`
      WITH latest_documents AS MATERIALIZED (
        SELECT DISTINCT ON (document.id) document.id, version.id AS version_id,
               document.sort_order,version.required_acceptance
        FROM family_registration_documents document
        JOIN family_registration_document_versions version
          ON version.document_id=document.id AND version.ludo_id=document.ludo_id
        WHERE document.form_id=${input.formId}::uuid AND document.ludo_id=${input.ludoId}::uuid
        ORDER BY document.id, version.version DESC
      ), updated AS (
        UPDATE family_registration_forms form
        SET revision=form.revision+1,updated_by_member_id=${input.memberId}::uuid,updated_at=${input.now}
        WHERE form.id=${input.formId}::uuid AND form.ludo_id=${input.ludoId}::uuid
          AND form.revision=${input.expectedRevision}
          AND char_length(trim(form.consent_label)) > 0
          AND EXISTS (SELECT 1 FROM latest_documents WHERE required_acceptance=true)
        RETURNING form.*
      ), inserted_version AS (
        INSERT INTO family_registration_form_versions
          (id,ludo_id,form_id,version,title,intro,consent_label,max_members,retention_days,
           annual_fee_cents,currency,allows_twint,allows_cash,
           published_by_member_id,published_at)
        SELECT ${input.versionId}::uuid,updated.ludo_id,updated.id,
               coalesce((SELECT max(v.version) FROM family_registration_form_versions v
                         WHERE v.form_id=updated.id AND v.ludo_id=updated.ludo_id),0)+1,
               updated.title,updated.intro,updated.consent_label,updated.max_members,
               updated.retention_days,updated.annual_fee_cents,updated.currency,
               updated.allows_twint,updated.allows_cash,${input.memberId}::uuid,${input.now}
        FROM updated RETURNING id,ludo_id,version
      ), linked AS (
        INSERT INTO family_registration_form_version_documents
          (form_version_id,document_version_id,ludo_id,sort_order)
        SELECT inserted_version.id,latest_documents.version_id,inserted_version.ludo_id,
               latest_documents.sort_order
        FROM inserted_version CROSS JOIN latest_documents
        RETURNING form_version_id
      )
      SELECT inserted_version.id,inserted_version.version FROM inserted_version
      WHERE EXISTS (SELECT 1 FROM linked)
    `),
  ])
  return result.rows[0]
}

export type PublishedFamilyConfigRow = {
  form_id: string
  form_version_id: string
  version: number
  title: string
  intro: string | null
  consent_label: string
  max_members: number
  retention_days: number
  annual_fee_cents: number
  currency: 'CHF'
  allows_twint: boolean
  allows_cash: boolean
  documents: Array<{
    id: string
    slug: string
    title: string
    kind: FamilyRegistrationDocumentKind
    requiredAcceptance: boolean
    version: number
    contentMarkdown: string
    sha256: string
  }>
}

export async function getPublishedFamilyConfigRow(ludoId: string) {
  const result = await db.execute<PublishedFamilyConfigRow>(sql`
    SELECT form.id AS form_id, published.id AS form_version_id, published.version,
           published.title,published.intro,published.consent_label,
           published.max_members,published.retention_days,published.annual_fee_cents,
           published.currency,published.allows_twint,published.allows_cash,
           coalesce(jsonb_agg(jsonb_build_object(
             'id',document.id,'slug',document.slug,'title',document_version.title,
             'kind',document_version.kind,'requiredAcceptance',document_version.required_acceptance,
             'version',document_version.version,'contentMarkdown',document_version.content_markdown,
             'sha256',document_version.sha256
           ) ORDER BY link.sort_order) FILTER (WHERE document.id IS NOT NULL),'[]'::jsonb) AS documents
    FROM family_registration_forms form
    JOIN LATERAL (
      SELECT version.* FROM family_registration_form_versions version
      WHERE version.form_id=form.id AND version.ludo_id=form.ludo_id
      ORDER BY version.version DESC LIMIT 1
    ) published ON true
    JOIN family_registration_form_version_documents link
      ON link.form_version_id=published.id AND link.ludo_id=published.ludo_id
    JOIN family_registration_document_versions document_version
      ON document_version.id=link.document_version_id AND document_version.ludo_id=link.ludo_id
    JOIN family_registration_documents document
      ON document.id=document_version.document_id AND document.ludo_id=document_version.ludo_id
    WHERE form.ludo_id=${ludoId}::uuid AND form.enabled=true
    GROUP BY form.id,published.id
  `)
  return result.rows[0]
}

export type FamilyMemberWrite = {
  id: string
  gender: FamilyRegistrationGender
  firstName: string
  lastName: string
  birthDate: string | null
  sortOrder: number
}

export async function insertFamilySubmissionAtomic(input: {
  id: string
  ludoId: string
  formId: string
  formVersionId: string
  formVersion: number
  siteId: string
  keyHash: string
  fingerprint: string
  gender: FamilyRegistrationGender
  firstName: string
  lastName: string
  birthDate: string | null
  address: string
  postalCode: string
  city: string
  phone: string
  secondaryPhone: string | null
  email: string
  consentFullName: string
  consentAcceptedOn: string
  consentAcceptedAt: Date
  consentLabelSnapshot: string
  consentDocumentsSnapshot: unknown
  members: FamilyMemberWrite[]
  now: Date
}) {
  const memberValues =
    input.members.length === 0
      ? sql`SELECT null::uuid AS id,null::text AS gender,null::text AS first_name,null::text AS last_name,null::date AS birth_date,null::int AS sort_order WHERE false`
      : sql`VALUES ${sql.join(
          input.members.map(
            (member) =>
              sql`(${member.id}::uuid,${member.gender}::text,${member.firstName},${member.lastName},${member.birthDate}::date,${member.sortOrder})`,
          ),
          sql`,`,
        )}`
  const result = await db.execute<{ id: string }>(sql`
    WITH desired_members(id,gender,first_name,last_name,birth_date,sort_order) AS (${memberValues}),
    receipt AS (
      INSERT INTO family_submission_receipts
        (ludo_id,idempotency_key_hash,request_fingerprint,receipt_id,submitted_at)
      VALUES (${input.ludoId}::uuid,${input.keyHash},${input.fingerprint},${input.id}::uuid,${input.now})
      ON CONFLICT (ludo_id,idempotency_key_hash) DO NOTHING
      RETURNING receipt_id
    ), inserted AS (
      INSERT INTO family_registration_submissions
        (id,ludo_id,form_id,form_version_id,site_id,gender,first_name,last_name,birth_date,
         address,postal_code,city,phone,secondary_phone,email,consent_accepted,
         consent_full_name,consent_accepted_on,consent_accepted_at,consent_label_snapshot,consent_documents_snapshot,
         status,revision,created_at,updated_at)
      SELECT receipt.receipt_id,${input.ludoId}::uuid,${input.formId}::uuid,
             ${input.formVersionId}::uuid,${input.siteId}::uuid,${input.gender},${input.firstName},
             ${input.lastName},${input.birthDate}::date,${input.address},${input.postalCode},
             ${input.city},${input.phone},${input.secondaryPhone},${input.email},true,
             ${input.consentFullName},${input.consentAcceptedOn}::date,${input.consentAcceptedAt},${input.consentLabelSnapshot},
             ${JSON.stringify(input.consentDocumentsSnapshot)}::jsonb,'new',1,${input.now},${input.now}
      FROM receipt RETURNING id,ludo_id
    ), inserted_members AS (
      INSERT INTO family_registration_submission_members
        (id,ludo_id,submission_id,gender,first_name,last_name,birth_date,sort_order)
      SELECT desired.id,inserted.ludo_id,inserted.id,
             desired.gender::family_registration_gender,desired.first_name,desired.last_name,
             desired.birth_date,desired.sort_order
      FROM inserted CROSS JOIN desired_members desired
      RETURNING submission_id
    )
    SELECT id FROM inserted
  `)
  return result.rows[0]
}

export function listFamilySubmissionRows(
  ludoId: string,
  status: FamilyRegistrationSubmissionStatus | undefined,
  limit: number,
) {
  return db
    .select({
      id: submissions.id,
      siteId: submissions.siteId,
      firstName: submissions.firstName,
      lastName: submissions.lastName,
      email: submissions.email,
      status: submissions.status,
      paymentMethod: submissions.paymentMethod,
      paymentRecordedAt: submissions.paymentRecordedAt,
      revision: submissions.revision,
      processedAt: submissions.processedAt,
      purgeAt: submissions.purgeAt,
      createdAt: submissions.createdAt,
    })
    .from(submissions)
    .where(and(eq(submissions.ludoId, ludoId), status ? eq(submissions.status, status) : undefined))
    .orderBy(desc(submissions.createdAt), asc(submissions.id))
    .limit(limit)
}

export async function getFamilySubmissionRowForLudo(id: string, ludoId: string) {
  const [submission] = await db
    .select({
      id: submissions.id,
      siteId: submissions.siteId,
      formVersionId: submissions.formVersionId,
      gender: submissions.gender,
      firstName: submissions.firstName,
      lastName: submissions.lastName,
      birthDate: submissions.birthDate,
      address: submissions.address,
      postalCode: submissions.postalCode,
      city: submissions.city,
      phone: submissions.phone,
      secondaryPhone: submissions.secondaryPhone,
      email: submissions.email,
      consentFullName: submissions.consentFullName,
      consentAcceptedOn: submissions.consentAcceptedOn,
      consentAcceptedAt: submissions.consentAcceptedAt,
      consentLabelSnapshot: submissions.consentLabelSnapshot,
      consentDocumentsSnapshot: submissions.consentDocumentsSnapshot,
      status: submissions.status,
      paymentMethod: submissions.paymentMethod,
      paymentRecordedAt: submissions.paymentRecordedAt,
      revision: submissions.revision,
      processedAt: submissions.processedAt,
      purgeAt: submissions.purgeAt,
      createdAt: submissions.createdAt,
    })
    .from(submissions)
    .where(and(eq(submissions.id, id), eq(submissions.ludoId, ludoId)))
  if (!submission) return undefined
  const members = await db
    .select({
      id: submissionMembers.id,
      gender: submissionMembers.gender,
      firstName: submissionMembers.firstName,
      lastName: submissionMembers.lastName,
      birthDate: submissionMembers.birthDate,
      sortOrder: submissionMembers.sortOrder,
    })
    .from(submissionMembers)
    .where(
      and(
        eq(submissionMembers.submissionId, id),
        eq(submissionMembers.ludoId, ludoId),
      ),
    )
    .orderBy(asc(submissionMembers.sortOrder))
  return { ...submission, members }
}

export async function processFamilySubmissionAtomic(input: {
  id: string
  ludoId: string
  expectedRevision: number
  memberId: string
  now: Date
}) {
  const result = await db.execute<{ id: string }>(sql`
    WITH candidate AS MATERIALIZED (
      SELECT submission.id,version.retention_days
      FROM family_registration_submissions submission
      JOIN family_registration_form_versions version
        ON version.id=submission.form_version_id AND version.ludo_id=submission.ludo_id
      WHERE submission.id=${input.id}::uuid AND submission.ludo_id=${input.ludoId}::uuid
        AND submission.status='new' AND submission.revision=${input.expectedRevision}
    ), updated AS (
      UPDATE family_registration_submissions submission
      SET status='processed',
          processed_by_member_id=${input.memberId}::uuid,processed_at=${input.now},
          purge_at=${input.now} + candidate.retention_days * interval '1 day',
          revision=submission.revision+1,updated_at=${input.now}
      FROM candidate WHERE submission.id=candidate.id
      RETURNING submission.id
    ) SELECT id FROM updated
  `)
  return result.rows[0]
}

export async function recordFamilyPaymentAtomic(input: {
  id: string
  ludoId: string
  expectedRevision: number
  memberId: string
  paymentMethod: FamilyRegistrationPaymentMethod | null
  now: Date
}) {
  const result = await db.execute<{ id: string }>(sql`
    UPDATE family_registration_submissions submission SET
      payment_method=${input.paymentMethod},
      payment_recorded_at=${input.paymentMethod ? input.now : null},
      payment_recorded_by_member_id=${input.paymentMethod ? input.memberId : null}::uuid,
      revision=submission.revision+1,updated_at=${input.now}
    FROM family_registration_form_versions version
    WHERE submission.id=${input.id}::uuid AND submission.ludo_id=${input.ludoId}::uuid
      AND submission.revision=${input.expectedRevision} AND submission.status='processed'
      AND version.id=submission.form_version_id AND version.ludo_id=submission.ludo_id
      AND (${input.paymentMethod}::text IS NULL
        OR (${input.paymentMethod}::text='twint' AND version.allows_twint)
        OR (${input.paymentMethod}::text='cash' AND version.allows_cash))
    RETURNING submission.id
  `)
  return result.rows[0]
}

export async function purgeDueFamilySubmissionsRow(now: Date, limit: number) {
  const result = await db.execute<{ purged: number }>(sql`
    WITH eligible AS MATERIALIZED (
      SELECT submission.id,submission.ludo_id,submission.site_id,submission.payment_method,
             submission.processed_at::date AS processed_on,
             1+(SELECT count(*) FROM family_registration_submission_members member
                WHERE member.submission_id=submission.id AND member.ludo_id=submission.ludo_id)::int AS persons
      FROM family_registration_submissions submission
      JOIN family_submission_receipts receipt
        ON receipt.receipt_id=submission.id AND receipt.ludo_id=submission.ludo_id
      WHERE submission.status='processed' AND submission.purge_at <= ${now}
        AND receipt.purged_at IS NULL
      ORDER BY submission.purge_at,submission.id LIMIT ${limit} FOR UPDATE OF submission SKIP LOCKED
    ), stats AS (
      INSERT INTO family_processing_daily_stats
        (ludo_id,site_id,processed_on,submissions_count,persons_count,twint_count,cash_count,created_at,updated_at)
      SELECT ludo_id,site_id,processed_on,count(*)::int,sum(persons)::int,
             count(*) FILTER (WHERE payment_method='twint')::int,
             count(*) FILTER (WHERE payment_method='cash')::int,${now},${now}
      FROM eligible GROUP BY ludo_id,site_id,processed_on
      ON CONFLICT (ludo_id,site_id,processed_on) DO UPDATE SET
        submissions_count=family_processing_daily_stats.submissions_count+excluded.submissions_count,
        persons_count=family_processing_daily_stats.persons_count+excluded.persons_count,
        twint_count=family_processing_daily_stats.twint_count+excluded.twint_count,
        cash_count=family_processing_daily_stats.cash_count+excluded.cash_count,
        updated_at=excluded.updated_at
      RETURNING ludo_id
    ), marked AS (
      UPDATE family_submission_receipts receipt SET purged_at=${now}
      FROM eligible WHERE receipt.ludo_id=eligible.ludo_id AND receipt.receipt_id=eligible.id
        AND EXISTS (SELECT 1 FROM stats)
      RETURNING receipt.receipt_id,receipt.ludo_id
    ), deleted AS (
      DELETE FROM family_registration_submissions submission USING marked
      WHERE submission.id=marked.receipt_id AND submission.ludo_id=marked.ludo_id
      RETURNING submission.id
    ) SELECT count(*)::int AS purged FROM deleted
  `)
  return result.rows[0]?.purged ?? 0
}
