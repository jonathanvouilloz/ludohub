import { and, eq, sql } from 'drizzle-orm'
import { db } from './index.js'
import {
  campaigns,
  campaignSends,
  newsletterContacts,
  type CampaignInsert,
  type CampaignRow,
  type CampaignSendInsert,
  type NewsletterContactInsert,
  type NewsletterContactRow,
  type NewsletterContactTag,
} from '../schema.js'

// ─── Contacts ──────────────────────────────────────────────────────────────────

export type ContactSortColumn = 'email' | 'createdAt' | 'status' | 'tag'

export type ListContactsOptions = {
  limit?: number
  offset?: number
  sort?: { col: ContactSortColumn; dir: 'asc' | 'desc' }
}

/**
 * Liste paginée/triée des contacts d'une ludo. Sans `opts`, conserve le
 * comportement historique (tous les contacts, du plus récent au plus ancien).
 */
export async function listContacts(
  ludoId: string,
  opts: ListContactsOptions = {},
): Promise<NewsletterContactRow[]> {
  const { sort, limit, offset } = opts
  return db.query.newsletterContacts.findMany({
    where: eq(newsletterContacts.ludoId, ludoId),
    orderBy: (c, { asc, desc }) => {
      const dir = sort?.dir === 'asc' ? asc : desc
      switch (sort?.col) {
        case 'email':
          return dir(c.email)
        case 'status':
          return dir(c.status)
        case 'tag':
          return dir(c.tag)
        default:
          return dir(c.createdAt)
      }
    },
    limit,
    offset,
  })
}

export async function countContacts(ludoId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(newsletterContacts)
    .where(eq(newsletterContacts.ludoId, ludoId))
  return row?.n ?? 0
}

export async function getContactById(
  id: string,
  ludoId: string,
): Promise<NewsletterContactRow | undefined> {
  return db.query.newsletterContacts.findFirst({
    where: and(eq(newsletterContacts.id, id), eq(newsletterContacts.ludoId, ludoId)),
  })
}

/** Recherche un contact par email (insensible à la casse) dans une ludo — dédup. */
export async function findContactByEmail(
  ludoId: string,
  email: string,
): Promise<NewsletterContactRow | undefined> {
  return db.query.newsletterContacts.findFirst({
    where: and(
      eq(newsletterContacts.ludoId, ludoId),
      sql`lower(${newsletterContacts.email}) = ${email.toLowerCase()}`,
    ),
  })
}

export async function getContactByToken(token: string): Promise<NewsletterContactRow | undefined> {
  return db.query.newsletterContacts.findFirst({
    where: eq(newsletterContacts.unsubscribeToken, token),
  })
}

/** Tous les emails (en minuscules) d'une ludo — pour la dédup d'import en masse. */
export async function getContactEmails(ludoId: string): Promise<Set<string>> {
  const rows = await db
    .select({ email: newsletterContacts.email })
    .from(newsletterContacts)
    .where(eq(newsletterContacts.ludoId, ludoId))
  return new Set(rows.map((r) => r.email.toLowerCase()))
}

export async function createContact(data: NewsletterContactInsert): Promise<NewsletterContactRow> {
  const [row] = await db.insert(newsletterContacts).values(data).returning()
  return row
}

/** Insertion en masse (import). Ignore les collisions sur l'index unique (ludo, email). */
export async function insertContacts(rows: NewsletterContactInsert[]): Promise<number> {
  if (rows.length === 0) return 0
  const inserted = await db
    .insert(newsletterContacts)
    .values(rows)
    .onConflictDoNothing()
    .returning({ id: newsletterContacts.id })
  return inserted.length
}

export async function updateContact(
  id: string,
  ludoId: string,
  data: Partial<NewsletterContactInsert>,
): Promise<NewsletterContactRow | undefined> {
  const [row] = await db
    .update(newsletterContacts)
    .set(data)
    .where(and(eq(newsletterContacts.id, id), eq(newsletterContacts.ludoId, ludoId)))
    .returning()
  return row
}

export async function deleteContact(id: string, ludoId: string): Promise<boolean> {
  const deleted = await db
    .delete(newsletterContacts)
    .where(and(eq(newsletterContacts.id, id), eq(newsletterContacts.ludoId, ludoId)))
    .returning({ id: newsletterContacts.id })
  return deleted.length > 0
}

/**
 * Contacts destinataires d'un envoi : abonnés uniquement (exclut unsub/bounced).
 * `tag` optionnel : restreint à un segment précis (sinon tous les abonnés).
 */
export async function listSubscribedContacts(
  ludoId: string,
  tag?: NewsletterContactTag,
): Promise<NewsletterContactRow[]> {
  return db.query.newsletterContacts.findMany({
    where: and(
      eq(newsletterContacts.ludoId, ludoId),
      eq(newsletterContacts.status, 'subscribed'),
      tag ? eq(newsletterContacts.tag, tag) : undefined,
    ),
    orderBy: (c, { asc }) => asc(c.createdAt),
  })
}

export async function countSubscribed(ludoId: string, tag?: NewsletterContactTag): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(newsletterContacts)
    .where(
      and(
        eq(newsletterContacts.ludoId, ludoId),
        eq(newsletterContacts.status, 'subscribed'),
        tag ? eq(newsletterContacts.tag, tag) : undefined,
      ),
    )
  return row?.n ?? 0
}

/** Compteur d'abonnés par segment (tag), `total`, et `null` = non classés. */
export type SubscribedByTag = Record<NewsletterContactTag, number> & {
  null: number
  total: number
}

export async function countSubscribedByTag(ludoId: string): Promise<SubscribedByTag> {
  const rows = await db
    .select({ tag: newsletterContacts.tag, n: sql<number>`count(*)::int` })
    .from(newsletterContacts)
    .where(and(eq(newsletterContacts.ludoId, ludoId), eq(newsletterContacts.status, 'subscribed')))
    .groupBy(newsletterContacts.tag)

  const result: SubscribedByTag = {
    famille: 0,
    institution: 0,
    partenaire: 0,
    autre: 0,
    null: 0,
    total: 0,
  }
  for (const r of rows) {
    const key = (r.tag ?? 'null') as keyof SubscribedByTag
    result[key] = r.n
    result.total += r.n
  }
  return result
}

export async function setContactStatusByToken(
  token: string,
  status: 'unsubscribed',
): Promise<NewsletterContactRow | undefined> {
  const [row] = await db
    .update(newsletterContacts)
    .set({ status })
    .where(eq(newsletterContacts.unsubscribeToken, token))
    .returning()
  return row
}

/** Marque comme `bounced` un contact par email (webhook Resend). Toutes ludos. */
export async function markBouncedByEmail(email: string): Promise<void> {
  await db
    .update(newsletterContacts)
    .set({ status: 'bounced' })
    .where(sql`lower(${newsletterContacts.email}) = ${email.toLowerCase()}`)
}

// ─── Campagnes ─────────────────────────────────────────────────────────────────

export async function listCampaigns(ludoId: string): Promise<CampaignRow[]> {
  return db.query.campaigns.findMany({
    where: eq(campaigns.ludoId, ludoId),
    orderBy: (c, { desc }) => desc(c.createdAt),
  })
}

export async function getCampaignById(
  id: string,
  ludoId: string,
): Promise<CampaignRow | undefined> {
  return db.query.campaigns.findFirst({
    where: and(eq(campaigns.id, id), eq(campaigns.ludoId, ludoId)),
  })
}

export async function createCampaign(data: CampaignInsert): Promise<CampaignRow> {
  const [row] = await db.insert(campaigns).values(data).returning()
  return row
}

export async function updateCampaign(
  id: string,
  ludoId: string,
  data: Partial<CampaignInsert>,
): Promise<CampaignRow | undefined> {
  const [row] = await db
    .update(campaigns)
    .set(data)
    .where(and(eq(campaigns.id, id), eq(campaigns.ludoId, ludoId)))
    .returning()
  return row
}

export async function deleteCampaign(id: string, ludoId: string): Promise<boolean> {
  const deleted = await db
    .delete(campaigns)
    .where(and(eq(campaigns.id, id), eq(campaigns.ludoId, ludoId)))
    .returning({ id: campaigns.id })
  return deleted.length > 0
}

export async function insertCampaignSends(rows: CampaignSendInsert[]): Promise<void> {
  if (rows.length === 0) return
  await db.insert(campaignSends).values(rows)
}

/** Compteurs d'envoi d'une campagne (succès / échecs / rejets) depuis campaign_sends. */
export async function getCampaignSendStats(
  campaignId: string,
): Promise<{ sent: number; failed: number; bounced: number }> {
  const rows = await db
    .select({ status: campaignSends.status, n: sql<number>`count(*)::int` })
    .from(campaignSends)
    .where(eq(campaignSends.campaignId, campaignId))
    .groupBy(campaignSends.status)

  const stats = { sent: 0, failed: 0, bounced: 0 }
  for (const r of rows) stats[r.status] = r.n
  return stats
}

/** Marque comme `bounced` l'envoi correspondant à un id Resend (webhook). */
export async function markCampaignSendBouncedByResendId(resendId: string): Promise<void> {
  await db
    .update(campaignSends)
    .set({ status: 'bounced' })
    .where(eq(campaignSends.resendId, resendId))
}

/** Ids des contacts déjà destinataires d'une campagne (garde-fou anti-doublon). */
export async function getSentContactIds(campaignId: string): Promise<Set<string>> {
  const rows = await db
    .select({ contactId: campaignSends.contactId })
    .from(campaignSends)
    .where(eq(campaignSends.campaignId, campaignId))
  return new Set(rows.map((r) => r.contactId))
}
