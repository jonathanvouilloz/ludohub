import { relations, sql } from 'drizzle-orm'
import {
  boolean,
  check,
  date,
  doublePrecision,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

// ─── Better Auth tables ──────────────────────────────────────────────────────
// Ces tables sont requises par better-auth/adapters/drizzle

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  // Lien vers la ludo (1 user BA = 1 ludo)
  ludoId: uuid('ludo_id'),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  // Membre actif dans cette session
  ludoId: uuid('ludo_id'),
  memberId: uuid('member_id'),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

// ─── Core multi-tenant ───────────────────────────────────────────────────────

export const ludotheques = pgTable('ludotheques', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  color: text('color').notNull().default('#0073E6'),
  // Logo (URL Vercel Blob) — utilisé dans l'en-tête des emails newsletter
  logoUrl: text('logo_url'),
  address: text('address'),
  // Contact public (source : fiches Ville de Genève — voir docs/data/ludotheques-geneve.json)
  phone: text('phone'),
  email: text('email'),
  website: text('website'),
  responsible: text('responsible'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

/** Lieux physiques d'un espace LudoHub (un lieu par défaut, plusieurs si nécessaire). */
export const ludoSites = pgTable(
  'ludo_sites',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ludoId: uuid('ludo_id')
      .notNull()
      .references(() => ludotheques.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    address: text('address'),
    postalCode: text('postal_code'),
    city: text('city'),
    phone: text('phone'),
    email: text('email'),
    accessInfo: text('access_info'),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    isPrimary: boolean('is_primary').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    unique('ludo_sites_ludo_slug_unique').on(t.ludoId, t.slug),
    unique('ludo_sites_id_ludo_id_unique').on(t.id, t.ludoId),
    uniqueIndex('ludo_sites_one_active_primary_idx')
      .on(t.ludoId)
      .where(sql`${t.isPrimary} = true and ${t.isActive} = true`),
  ],
)

/** Horaires hebdomadaires simples. Plusieurs intervalles sont permis le même jour. */
export const siteOpeningIntervals = pgTable(
  'site_opening_intervals',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ludoId: uuid('ludo_id')
      .notNull()
      .references(() => ludotheques.id, { onDelete: 'cascade' }),
    siteId: uuid('site_id').notNull(),
    dayOfWeek: integer('day_of_week').notNull(),
    opensAt: time('opens_at', { precision: 0 }).notNull(),
    closesAt: time('closes_at', { precision: 0 }).notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      columns: [t.siteId, t.ludoId],
      foreignColumns: [ludoSites.id, ludoSites.ludoId],
      name: 'site_opening_intervals_site_tenant_fk',
    }).onDelete('cascade'),
    unique('site_opening_intervals_slot_unique').on(t.siteId, t.dayOfWeek, t.opensAt, t.closesAt),
    check('site_opening_intervals_day_check', sql`${t.dayOfWeek} between 1 and 7`),
    check('site_opening_intervals_time_check', sql`${t.opensAt} < ${t.closesAt}`),
  ],
)

// Statut commun aux futurs contenus éditoriaux publics. Les tables de domaine
// restent séparées ; seul leur cycle de publication est mutualisé.
export const publicContentStatus = pgEnum('public_content_status', ['draft', 'published', 'hidden'])

/** Activation du module public, une ligne au plus par espace LudoHub. */
export const publicSiteSettings = pgTable('public_site_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  ludoId: uuid('ludo_id')
    .notNull()
    .unique()
    .references(() => ludotheques.id, { onDelete: 'cascade' }),
  enabled: boolean('enabled').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const memberRole = pgEnum('member_role', ['member', 'responsable'])

export const members = pgTable(
  'members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ludoId: uuid('ludo_id')
      .notNull()
      .references(() => ludotheques.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    role: memberRole('role').notNull().default('member'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [unique('members_id_ludo_id_unique').on(t.id, t.ludoId)],
)

/** Annonce éditoriale publique, activée et désactivée manuellement. */
export const publicAnnouncements = pgTable(
  'public_announcements',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ludoId: uuid('ludo_id')
      .notNull()
      .references(() => ludotheques.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    message: text('message').notNull(),
    status: publicContentStatus('status').notNull().default('draft'),
    revision: integer('revision').notNull().default(1),
    authorMemberId: uuid('author_member_id').notNull(),
    updatedByMemberId: uuid('updated_by_member_id').notNull(),
    publishedByMemberId: uuid('published_by_member_id'),
    publishedAt: timestamp('published_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    unique('public_announcements_id_ludo_id_unique').on(t.id, t.ludoId),
    foreignKey({
      columns: [t.authorMemberId, t.ludoId],
      foreignColumns: [members.id, members.ludoId],
      name: 'public_announcements_author_tenant_fk',
    }),
    foreignKey({
      columns: [t.updatedByMemberId, t.ludoId],
      foreignColumns: [members.id, members.ludoId],
      name: 'public_announcements_updated_by_tenant_fk',
    }),
    foreignKey({
      columns: [t.publishedByMemberId, t.ludoId],
      foreignColumns: [members.id, members.ludoId],
      name: 'public_announcements_published_by_tenant_fk',
    }),
    check(
      'public_announcements_publication_state_check',
      sql`(${t.status} = 'draft' and ${t.publishedAt} is null and ${t.publishedByMemberId} is null) or (${t.status} in ('published', 'hidden') and ${t.publishedAt} is not null and ${t.publishedByMemberId} is not null)`,
    ),
    check(
      'public_announcements_title_length_check',
      sql`char_length(trim(${t.title})) between 1 and 160`,
    ),
    check(
      'public_announcements_message_length_check',
      sql`char_length(trim(${t.message})) between 1 and 2000`,
    ),
    index('public_announcements_ludo_status_created_idx').on(
      t.ludoId,
      t.status,
      t.createdAt.desc(),
    ),
  ],
)

/**
 * Cibles explicites d'une annonce. L'absence de ligne signifie « tous les lieux
 * actifs ». Un lieu ciblé ne peut donc pas être supprimé silencieusement.
 */
export const publicAnnouncementSites = pgTable(
  'public_announcement_sites',
  {
    announcementId: uuid('announcement_id').notNull(),
    ludoId: uuid('ludo_id').notNull(),
    siteId: uuid('site_id').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.announcementId, t.siteId] }),
    foreignKey({
      columns: [t.announcementId, t.ludoId],
      foreignColumns: [publicAnnouncements.id, publicAnnouncements.ludoId],
      name: 'public_announcement_sites_announcement_tenant_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [t.siteId, t.ludoId],
      foreignColumns: [ludoSites.id, ludoSites.ludoId],
      name: 'public_announcement_sites_site_tenant_fk',
    }),
  ],
)

/** Actualité Markdown publiée sur le site public. */
export const publicNews = pgTable(
  'public_news',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ludoId: uuid('ludo_id')
      .notNull()
      .references(() => ludotheques.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    summary: text('summary').notNull(),
    body: text('body').notNull(),
    imageUrl: text('image_url'),
    imageStorageKey: text('image_storage_key'),
    imageAlt: text('image_alt'),
    status: publicContentStatus('status').notNull().default('draft'),
    revision: integer('revision').notNull().default(1),
    authorMemberId: uuid('author_member_id').notNull(),
    updatedByMemberId: uuid('updated_by_member_id').notNull(),
    publishedByMemberId: uuid('published_by_member_id'),
    publishedAt: timestamp('published_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    unique('public_news_id_ludo_id_unique').on(t.id, t.ludoId),
    unique('public_news_ludo_slug_unique').on(t.ludoId, t.slug),
    foreignKey({
      columns: [t.authorMemberId, t.ludoId],
      foreignColumns: [members.id, members.ludoId],
      name: 'public_news_author_tenant_fk',
    }),
    foreignKey({
      columns: [t.updatedByMemberId, t.ludoId],
      foreignColumns: [members.id, members.ludoId],
      name: 'public_news_updated_by_tenant_fk',
    }),
    foreignKey({
      columns: [t.publishedByMemberId, t.ludoId],
      foreignColumns: [members.id, members.ludoId],
      name: 'public_news_published_by_tenant_fk',
    }),
    check(
      'public_news_publication_state_check',
      sql`(${t.status} = 'draft' and ${t.publishedAt} is null and ${t.publishedByMemberId} is null) or (${t.status} in ('published', 'hidden') and ${t.publishedAt} is not null and ${t.publishedByMemberId} is not null)`,
    ),
    check('public_news_slug_check', sql`char_length(${t.slug}) between 1 and 120`),
    check('public_news_title_check', sql`char_length(trim(${t.title})) between 1 and 180`),
    check('public_news_summary_check', sql`char_length(trim(${t.summary})) between 1 and 500`),
    check('public_news_body_check', sql`char_length(trim(${t.body})) between 1 and 50000`),
    check(
      'public_news_image_check',
      sql`(${t.imageUrl} is null and ${t.imageStorageKey} is null and ${t.imageAlt} is null) or (${t.imageUrl} is not null and char_length(trim(${t.imageUrl})) between 1 and 2000 and ${t.imageStorageKey} is not null and char_length(trim(${t.imageStorageKey})) between 1 and 1000 and ${t.imageAlt} is not null and char_length(trim(${t.imageAlt})) between 1 and 300)`,
    ),
    index('public_news_public_published_idx').on(t.ludoId, t.status, t.publishedAt.desc()),
  ],
)

/** Cibles explicites d'une actualité ; aucune ligne signifie tous les lieux actifs. */
export const publicNewsSites = pgTable(
  'public_news_sites',
  {
    newsId: uuid('news_id').notNull(),
    ludoId: uuid('ludo_id').notNull(),
    siteId: uuid('site_id').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.newsId, t.siteId] }),
    foreignKey({
      columns: [t.newsId, t.ludoId],
      foreignColumns: [publicNews.id, publicNews.ludoId],
      name: 'public_news_sites_news_tenant_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [t.siteId, t.ludoId],
      foreignColumns: [ludoSites.id, ludoSites.ludoId],
      name: 'public_news_sites_site_tenant_fk',
    }),
  ],
)

export type PublicTopThreeGame = { name: string; description?: string }

/** Sélection éditoriale de trois jeux saisis directement, sans lien au catalogue. */
export const publicTopThrees = pgTable(
  'public_top_threes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ludoId: uuid('ludo_id')
      .notNull()
      .references(() => ludotheques.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    theme: text('theme').notNull(),
    games: jsonb('games').$type<PublicTopThreeGame[]>().notNull(),
    isHomepage: boolean('is_homepage').notNull().default(false),
    status: publicContentStatus('status').notNull().default('draft'),
    revision: integer('revision').notNull().default(1),
    authorMemberId: uuid('author_member_id').notNull(),
    updatedByMemberId: uuid('updated_by_member_id').notNull(),
    publishedByMemberId: uuid('published_by_member_id'),
    publishedAt: timestamp('published_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    unique('public_top_threes_id_ludo_id_unique').on(t.id, t.ludoId),
    unique('public_top_threes_ludo_slug_unique').on(t.ludoId, t.slug),
    foreignKey({
      columns: [t.authorMemberId, t.ludoId],
      foreignColumns: [members.id, members.ludoId],
      name: 'public_top_threes_author_tenant_fk',
    }),
    foreignKey({
      columns: [t.updatedByMemberId, t.ludoId],
      foreignColumns: [members.id, members.ludoId],
      name: 'public_top_threes_updated_by_tenant_fk',
    }),
    foreignKey({
      columns: [t.publishedByMemberId, t.ludoId],
      foreignColumns: [members.id, members.ludoId],
      name: 'public_top_threes_published_by_tenant_fk',
    }),
    check(
      'public_top_threes_publication_state_check',
      sql`(${t.status} = 'draft' and ${t.publishedAt} is null and ${t.publishedByMemberId} is null) or (${t.status} in ('published', 'hidden') and ${t.publishedAt} is not null and ${t.publishedByMemberId} is not null)`,
    ),
    check('public_top_threes_slug_check', sql`char_length(${t.slug}) between 1 and 120`),
    check('public_top_threes_theme_check', sql`char_length(trim(${t.theme})) between 1 and 160`),
    check(
      'public_top_threes_games_shape_check',
      sql`jsonb_typeof(${t.games}) = 'array' and jsonb_array_length(${t.games}) = 3 and not jsonb_path_exists(${t.games}, '$[*] ? (@.type() != "object" || !exists(@.name) || @.name.type() != "string" || (exists(@.description) && @.description.type() != "string"))') and not jsonb_path_exists(${t.games}, '$[*].keyvalue() ? (@.key != "name" && @.key != "description")') and not jsonb_path_exists(${t.games}, '$[*] ? (!(@.name like_regex "^\\\\s*.{0,159}\\\\S\\\\s*$" flag "s") || (exists(@.description) && !(@.description like_regex "^\\\\s*.{0,1999}\\\\S\\\\s*$" flag "s")))')`,
    ),
    check(
      'public_top_threes_homepage_published_check',
      sql`not ${t.isHomepage} or ${t.status} = 'published'`,
    ),
    uniqueIndex('public_top_threes_one_homepage_per_ludo_idx')
      .on(t.ludoId)
      .where(sql`${t.isHomepage} = true`),
    index('public_top_threes_public_published_idx').on(t.ludoId, t.status, t.publishedAt.desc()),
  ],
)

/** Cibles explicites d'un Top 3 ; aucune ligne signifie tous les lieux actifs. */
export const publicTopThreeSites = pgTable(
  'public_top_three_sites',
  {
    topThreeId: uuid('top_three_id').notNull(),
    ludoId: uuid('ludo_id').notNull(),
    siteId: uuid('site_id').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.topThreeId, t.siteId] }),
    foreignKey({
      columns: [t.topThreeId, t.ludoId],
      foreignColumns: [publicTopThrees.id, publicTopThrees.ludoId],
      name: 'public_top_three_sites_top_three_tenant_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [t.siteId, t.ludoId],
      foreignColumns: [ludoSites.id, ludoSites.ludoId],
      name: 'public_top_three_sites_site_tenant_fk',
    }),
  ],
)

/** Question fréquente ordonnée manuellement sur le site public. */
export const publicFaqs = pgTable(
  'public_faqs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ludoId: uuid('ludo_id')
      .notNull()
      .references(() => ludotheques.id, { onDelete: 'cascade' }),
    question: text('question').notNull(),
    answerMarkdown: text('answer_markdown').notNull(),
    category: text('category'),
    sortOrder: integer('sort_order').notNull().default(0),
    status: publicContentStatus('status').notNull().default('draft'),
    revision: integer('revision').notNull().default(1),
    authorMemberId: uuid('author_member_id').notNull(),
    updatedByMemberId: uuid('updated_by_member_id').notNull(),
    publishedByMemberId: uuid('published_by_member_id'),
    publishedAt: timestamp('published_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    unique('public_faqs_id_ludo_id_unique').on(t.id, t.ludoId),
    foreignKey({
      columns: [t.authorMemberId, t.ludoId],
      foreignColumns: [members.id, members.ludoId],
      name: 'public_faqs_author_tenant_fk',
    }),
    foreignKey({
      columns: [t.updatedByMemberId, t.ludoId],
      foreignColumns: [members.id, members.ludoId],
      name: 'public_faqs_updated_by_tenant_fk',
    }),
    foreignKey({
      columns: [t.publishedByMemberId, t.ludoId],
      foreignColumns: [members.id, members.ludoId],
      name: 'public_faqs_published_by_tenant_fk',
    }),
    check(
      'public_faqs_publication_state_check',
      sql`(${t.status} = 'draft' and ${t.publishedAt} is null and ${t.publishedByMemberId} is null) or (${t.status} in ('published', 'hidden') and ${t.publishedAt} is not null and ${t.publishedByMemberId} is not null)`,
    ),
    check('public_faqs_question_check', sql`char_length(trim(${t.question})) between 1 and 300`),
    check(
      'public_faqs_answer_check',
      sql`char_length(trim(${t.answerMarkdown})) between 1 and 20000`,
    ),
    check(
      'public_faqs_category_check',
      sql`${t.category} is null or char_length(trim(${t.category})) between 1 and 100`,
    ),
    check('public_faqs_sort_order_check', sql`${t.sortOrder} between 0 and 1000000`),
    index('public_faqs_public_order_idx').on(t.ludoId, t.status, t.sortOrder, t.id),
  ],
)

export const publicFaqSites = pgTable(
  'public_faq_sites',
  {
    faqId: uuid('faq_id').notNull(),
    ludoId: uuid('ludo_id').notNull(),
    siteId: uuid('site_id').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.faqId, t.siteId] }),
    foreignKey({
      columns: [t.faqId, t.ludoId],
      foreignColumns: [publicFaqs.id, publicFaqs.ludoId],
      name: 'public_faq_sites_faq_tenant_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [t.siteId, t.ludoId],
      foreignColumns: [ludoSites.id, ludoSites.ludoId],
      name: 'public_faq_sites_site_tenant_fk',
    }),
  ],
)

export const publicDocumentKind = pgEnum('public_document_kind', [
  'mission',
  'statutes',
  'annual_report',
  'other',
])

/** Document institutionnel Markdown et/ou PDF géré. */
export const publicDocuments = pgTable(
  'public_documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ludoId: uuid('ludo_id')
      .notNull()
      .references(() => ludotheques.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    kind: publicDocumentKind('kind').notNull(),
    title: text('title').notNull(),
    summary: text('summary'),
    bodyMarkdown: text('body_markdown'),
    year: integer('year'),
    pdfUrl: text('pdf_url'),
    pdfStorageKey: text('pdf_storage_key'),
    pdfFileName: text('pdf_file_name'),
    status: publicContentStatus('status').notNull().default('draft'),
    revision: integer('revision').notNull().default(1),
    authorMemberId: uuid('author_member_id').notNull(),
    updatedByMemberId: uuid('updated_by_member_id').notNull(),
    publishedByMemberId: uuid('published_by_member_id'),
    publishedAt: timestamp('published_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    unique('public_documents_id_ludo_id_unique').on(t.id, t.ludoId),
    unique('public_documents_ludo_slug_unique').on(t.ludoId, t.slug),
    foreignKey({
      columns: [t.authorMemberId, t.ludoId],
      foreignColumns: [members.id, members.ludoId],
      name: 'public_documents_author_tenant_fk',
    }),
    foreignKey({
      columns: [t.updatedByMemberId, t.ludoId],
      foreignColumns: [members.id, members.ludoId],
      name: 'public_documents_updated_by_tenant_fk',
    }),
    foreignKey({
      columns: [t.publishedByMemberId, t.ludoId],
      foreignColumns: [members.id, members.ludoId],
      name: 'public_documents_published_by_tenant_fk',
    }),
    check(
      'public_documents_publication_state_check',
      sql`(${t.status} = 'draft' and ${t.publishedAt} is null and ${t.publishedByMemberId} is null) or (${t.status} in ('published', 'hidden') and ${t.publishedAt} is not null and ${t.publishedByMemberId} is not null)`,
    ),
    check('public_documents_slug_check', sql`char_length(${t.slug}) between 1 and 120`),
    check('public_documents_title_check', sql`char_length(trim(${t.title})) between 1 and 180`),
    check(
      'public_documents_summary_check',
      sql`${t.summary} is null or char_length(trim(${t.summary})) between 1 and 500`,
    ),
    check(
      'public_documents_body_check',
      sql`${t.bodyMarkdown} is null or char_length(trim(${t.bodyMarkdown})) between 1 and 50000`,
    ),
    check(
      'public_documents_year_check',
      sql`(${t.kind} = 'annual_report' and ${t.year} between 1000 and 9999) or (${t.kind} <> 'annual_report' and ${t.year} is null)`,
    ),
    check(
      'public_documents_pdf_check',
      sql`(${t.pdfUrl} is null and ${t.pdfStorageKey} is null and ${t.pdfFileName} is null) or (${t.pdfUrl} is not null and char_length(trim(${t.pdfUrl})) between 1 and 2000 and ${t.pdfStorageKey} is not null and char_length(trim(${t.pdfStorageKey})) between 1 and 1000 and ${t.pdfFileName} is not null and char_length(trim(${t.pdfFileName})) between 1 and 300)`,
    ),
    check(
      'public_documents_content_check',
      sql`${t.status} = 'draft' or ${t.bodyMarkdown} is not null or ${t.pdfStorageKey} is not null`,
    ),
    index('public_documents_public_idx').on(
      t.ludoId,
      t.status,
      t.kind,
      t.year.desc(),
      t.publishedAt.desc(),
    ),
  ],
)

export const publicDocumentSites = pgTable(
  'public_document_sites',
  {
    documentId: uuid('document_id').notNull(),
    ludoId: uuid('ludo_id').notNull(),
    siteId: uuid('site_id').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.documentId, t.siteId] }),
    foreignKey({
      columns: [t.documentId, t.ludoId],
      foreignColumns: [publicDocuments.id, publicDocuments.ludoId],
      name: 'public_document_sites_document_tenant_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [t.siteId, t.ludoId],
      foreignColumns: [ludoSites.id, ludoSites.ludoId],
      name: 'public_document_sites_site_tenant_fk',
    }),
  ],
)

/** Image autonome de galerie publique, sans notion d'album. */
export const publicGalleryImages = pgTable(
  'public_gallery_images',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ludoId: uuid('ludo_id')
      .notNull()
      .references(() => ludotheques.id, { onDelete: 'cascade' }),
    caption: text('caption'),
    alt: text('alt'),
    sortOrder: integer('sort_order').notNull().default(0),
    imageUrl: text('image_url'),
    imageStorageKey: text('image_storage_key'),
    status: publicContentStatus('status').notNull().default('draft'),
    revision: integer('revision').notNull().default(1),
    authorMemberId: uuid('author_member_id').notNull(),
    updatedByMemberId: uuid('updated_by_member_id').notNull(),
    publishedByMemberId: uuid('published_by_member_id'),
    publishedAt: timestamp('published_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    unique('public_gallery_images_id_ludo_id_unique').on(t.id, t.ludoId),
    foreignKey({
      columns: [t.authorMemberId, t.ludoId],
      foreignColumns: [members.id, members.ludoId],
      name: 'public_gallery_images_author_tenant_fk',
    }),
    foreignKey({
      columns: [t.updatedByMemberId, t.ludoId],
      foreignColumns: [members.id, members.ludoId],
      name: 'public_gallery_images_updated_by_tenant_fk',
    }),
    foreignKey({
      columns: [t.publishedByMemberId, t.ludoId],
      foreignColumns: [members.id, members.ludoId],
      name: 'public_gallery_images_published_by_tenant_fk',
    }),
    check(
      'public_gallery_images_publication_check',
      sql`(${t.status} = 'draft' and ${t.publishedAt} is null and ${t.publishedByMemberId} is null) or (${t.status} in ('published','hidden') and ${t.publishedAt} is not null and ${t.publishedByMemberId} is not null and ${t.imageStorageKey} is not null and ${t.alt} is not null)`,
    ),
    check(
      'public_gallery_images_caption_check',
      sql`${t.caption} is null or char_length(trim(${t.caption})) between 1 and 500`,
    ),
    check(
      'public_gallery_images_alt_check',
      sql`${t.alt} is null or char_length(trim(${t.alt})) between 1 and 300`,
    ),
    check('public_gallery_images_sort_check', sql`${t.sortOrder} between 0 and 1000000`),
    check(
      'public_gallery_images_file_check',
      sql`(${t.imageUrl} is null and ${t.imageStorageKey} is null) or (${t.imageUrl} is not null and char_length(trim(${t.imageUrl})) between 1 and 2000 and ${t.imageStorageKey} is not null and char_length(trim(${t.imageStorageKey})) between 1 and 1000)`,
    ),
    index('public_gallery_images_public_order_idx').on(t.ludoId, t.status, t.sortOrder, t.id),
  ],
)

export const publicGalleryImageSites = pgTable(
  'public_gallery_image_sites',
  {
    imageId: uuid('image_id').notNull(),
    ludoId: uuid('ludo_id').notNull(),
    siteId: uuid('site_id').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.imageId, t.siteId] }),
    foreignKey({
      columns: [t.imageId, t.ludoId],
      foreignColumns: [publicGalleryImages.id, publicGalleryImages.ludoId],
      name: 'public_gallery_image_sites_image_tenant_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [t.siteId, t.ludoId],
      foreignColumns: [ludoSites.id, ludoSites.ludoId],
      name: 'public_gallery_image_sites_site_tenant_fk',
    }),
  ],
)

export const publicProfileSection = pgEnum('public_profile_section', ['team', 'committee'])

/** Profil public éditorial ; le membre lié reste une référence interne optionnelle. */
export const publicProfiles = pgTable(
  'public_profiles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ludoId: uuid('ludo_id')
      .notNull()
      .references(() => ludotheques.id, { onDelete: 'cascade' }),
    memberId: uuid('member_id'),
    section: publicProfileSection('section').notNull(),
    displayName: text('display_name').notNull(),
    roleTitle: text('role_title'),
    bioMarkdown: text('bio_markdown'),
    sortOrder: integer('sort_order').notNull().default(0),
    photoUrl: text('photo_url'),
    photoStorageKey: text('photo_storage_key'),
    photoAlt: text('photo_alt'),
    status: publicContentStatus('status').notNull().default('draft'),
    revision: integer('revision').notNull().default(1),
    authorMemberId: uuid('author_member_id').notNull(),
    updatedByMemberId: uuid('updated_by_member_id').notNull(),
    publishedByMemberId: uuid('published_by_member_id'),
    publishedAt: timestamp('published_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    unique('public_profiles_id_ludo_id_unique').on(t.id, t.ludoId),
    foreignKey({
      columns: [t.memberId, t.ludoId],
      foreignColumns: [members.id, members.ludoId],
      name: 'public_profiles_member_tenant_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [t.authorMemberId, t.ludoId],
      foreignColumns: [members.id, members.ludoId],
      name: 'public_profiles_author_tenant_fk',
    }),
    foreignKey({
      columns: [t.updatedByMemberId, t.ludoId],
      foreignColumns: [members.id, members.ludoId],
      name: 'public_profiles_updated_by_tenant_fk',
    }),
    foreignKey({
      columns: [t.publishedByMemberId, t.ludoId],
      foreignColumns: [members.id, members.ludoId],
      name: 'public_profiles_published_by_tenant_fk',
    }),
    check(
      'public_profiles_publication_check',
      sql`(${t.status} = 'draft' and ${t.publishedAt} is null and ${t.publishedByMemberId} is null) or (${t.status} in ('published','hidden') and ${t.publishedAt} is not null and ${t.publishedByMemberId} is not null)`,
    ),
    check(
      'public_profiles_display_name_check',
      sql`char_length(trim(${t.displayName})) between 1 and 160`,
    ),
    check(
      'public_profiles_role_check',
      sql`${t.roleTitle} is null or char_length(trim(${t.roleTitle})) between 1 and 200`,
    ),
    check(
      'public_profiles_bio_check',
      sql`${t.bioMarkdown} is null or char_length(trim(${t.bioMarkdown})) between 1 and 10000`,
    ),
    check('public_profiles_sort_check', sql`${t.sortOrder} between 0 and 1000000`),
    check(
      'public_profiles_photo_check',
      sql`(${t.photoUrl} is null and ${t.photoStorageKey} is null and ${t.photoAlt} is null) or (${t.photoUrl} is not null and char_length(trim(${t.photoUrl})) between 1 and 2000 and ${t.photoStorageKey} is not null and char_length(trim(${t.photoStorageKey})) between 1 and 1000 and ${t.photoAlt} is not null and char_length(trim(${t.photoAlt})) between 1 and 300)`,
    ),
    index('public_profiles_public_order_idx').on(t.ludoId, t.status, t.section, t.sortOrder, t.id),
  ],
)

export const publicProfileSites = pgTable(
  'public_profile_sites',
  {
    profileId: uuid('profile_id').notNull(),
    ludoId: uuid('ludo_id').notNull(),
    siteId: uuid('site_id').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.profileId, t.siteId] }),
    foreignKey({
      columns: [t.profileId, t.ludoId],
      foreignColumns: [publicProfiles.id, publicProfiles.ludoId],
      name: 'public_profile_sites_profile_tenant_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [t.siteId, t.ludoId],
      foreignColumns: [ludoSites.id, ludoSites.ludoId],
      name: 'public_profile_sites_site_tenant_fk',
    }),
  ],
)

/** Entrée administrable de l'annuaire genevois propre à un tenant. */
export const publicDirectoryEntries = pgTable(
  'public_directory_entries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ludoId: uuid('ludo_id')
      .notNull()
      .references(() => ludotheques.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    descriptionMarkdown: text('description_markdown'),
    address: text('address'),
    postalCode: text('postal_code'),
    city: text('city').notNull().default('Genève'),
    phone: text('phone'),
    email: text('email'),
    website: text('website'),
    directionsUrl: text('directions_url').notNull(),
    officialUrl: text('official_url').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    status: publicContentStatus('status').notNull().default('draft'),
    revision: integer('revision').notNull().default(1),
    authorMemberId: uuid('author_member_id').notNull(),
    updatedByMemberId: uuid('updated_by_member_id').notNull(),
    publishedByMemberId: uuid('published_by_member_id'),
    publishedAt: timestamp('published_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    unique('public_directory_entries_id_ludo_id_unique').on(t.id, t.ludoId),
    unique('public_directory_entries_ludo_slug_unique').on(t.ludoId, t.slug),
    foreignKey({
      columns: [t.authorMemberId, t.ludoId],
      foreignColumns: [members.id, members.ludoId],
      name: 'public_directory_entries_author_tenant_fk',
    }),
    foreignKey({
      columns: [t.updatedByMemberId, t.ludoId],
      foreignColumns: [members.id, members.ludoId],
      name: 'public_directory_entries_updated_by_tenant_fk',
    }),
    foreignKey({
      columns: [t.publishedByMemberId, t.ludoId],
      foreignColumns: [members.id, members.ludoId],
      name: 'public_directory_entries_published_by_tenant_fk',
    }),
    check(
      'public_directory_entries_publication_check',
      sql`(${t.status}='draft' and ${t.publishedAt} is null and ${t.publishedByMemberId} is null) or (${t.status} in ('published','hidden') and ${t.publishedAt} is not null and ${t.publishedByMemberId} is not null)`,
    ),
    check(
      'public_directory_entries_name_check',
      sql`char_length(trim(${t.name})) between 1 and 180`,
    ),
    check(
      'public_directory_entries_description_check',
      sql`${t.descriptionMarkdown} is null or char_length(trim(${t.descriptionMarkdown})) between 1 and 10000`,
    ),
    check(
      'public_directory_entries_contact_check',
      sql`${t.address} is null or char_length(trim(${t.address})) between 1 and 500`,
    ),
    check(
      'public_directory_entries_urls_check',
      sql`char_length(trim(${t.directionsUrl})) between 1 and 2000 and char_length(trim(${t.officialUrl})) between 1 and 2000`,
    ),
    check('public_directory_entries_sort_check', sql`${t.sortOrder} between 0 and 1000000`),
    index('public_directory_entries_public_order_idx').on(t.ludoId, t.status, t.sortOrder, t.id),
  ],
)

export const publicContactStatus = pgEnum('public_contact_status', ['new', 'processed', 'archived'])
export const publicContactRecipient = pgEnum('public_contact_recipient', [
  'paquis',
  'secheron',
  'general',
])
/** Message entrant privé. Cette table ne doit jamais alimenter une API publique de lecture. */
export const publicContactMessages = pgTable(
  'public_contact_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ludoId: uuid('ludo_id')
      .notNull()
      .references(() => ludotheques.id, { onDelete: 'cascade' }),
    idempotencyKeyHash: text('idempotency_key_hash').notNull(),
    recipient: publicContactRecipient('recipient').notNull(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    phone: text('phone'),
    subject: text('subject').notNull(),
    message: text('message').notNull(),
    status: publicContactStatus('status').notNull().default('new'),
    revision: integer('revision').notNull().default(1),
    handledByMemberId: uuid('handled_by_member_id'),
    processedAt: timestamp('processed_at'),
    archivedAt: timestamp('archived_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    unique('public_contact_messages_id_ludo_id_unique').on(t.id, t.ludoId),
    unique('public_contact_messages_ludo_idempotency_unique').on(t.ludoId, t.idempotencyKeyHash),
    foreignKey({
      columns: [t.handledByMemberId, t.ludoId],
      foreignColumns: [members.id, members.ludoId],
      name: 'public_contact_messages_handler_tenant_fk',
    }),
    check('public_contact_messages_hash_check', sql`char_length(${t.idempotencyKeyHash})=64`),
    check(
      'public_contact_messages_name_check',
      sql`char_length(trim(${t.name})) between 1 and 160`,
    ),
    check(
      'public_contact_messages_email_check',
      sql`char_length(trim(${t.email})) between 3 and 320`,
    ),
    check(
      'public_contact_messages_phone_check',
      sql`${t.phone} is null or char_length(trim(${t.phone})) between 3 and 50`,
    ),
    check(
      'public_contact_messages_subject_check',
      sql`char_length(trim(${t.subject})) between 1 and 200`,
    ),
    check(
      'public_contact_messages_message_check',
      sql`char_length(trim(${t.message})) between 1 and 5000`,
    ),
    check(
      'public_contact_messages_state_check',
      sql`(${t.status}='new' and ${t.processedAt} is null and ${t.archivedAt} is null) or (${t.status}='processed' and ${t.processedAt} is not null and ${t.archivedAt} is null and ${t.handledByMemberId} is not null) or (${t.status}='archived' and ${t.archivedAt} is not null and ${t.handledByMemberId} is not null)`,
    ),
    index('public_contact_messages_inbox_idx').on(t.ludoId, t.status, t.createdAt.desc()),
  ],
)

export const publicActivityType = pgEnum('public_activity_type', [
  'one_off',
  'recurring',
  'permanent',
])

export const publicActivityLifecycle = pgEnum('public_activity_lifecycle', [
  'active',
  'archived',
  'trashed',
])

/** Activité publique avec publication et cycle d'archivage séparés. */
export const publicActivities = pgTable(
  'public_activities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ludoId: uuid('ludo_id')
      .notNull()
      .references(() => ludotheques.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    summary: text('summary').notNull(),
    body: text('body').notNull(),
    location: text('location'),
    type: publicActivityType('type').notNull(),
    recurrenceRule: text('recurrence_rule'),
    imageUrl: text('image_url'),
    imageStorageKey: text('image_storage_key'),
    imageAlt: text('image_alt'),
    status: publicContentStatus('status').notNull().default('draft'),
    lifecycle: publicActivityLifecycle('lifecycle').notNull().default('active'),
    featuredRank: integer('featured_rank'),
    registrationEnabled: boolean('registration_enabled').notNull().default(false),
    registrationCapacity: integer('registration_capacity'),
    revision: integer('revision').notNull().default(1),
    authorMemberId: uuid('author_member_id').notNull(),
    updatedByMemberId: uuid('updated_by_member_id').notNull(),
    publishedByMemberId: uuid('published_by_member_id'),
    publishedAt: timestamp('published_at'),
    archivedAt: timestamp('archived_at'),
    trashedAt: timestamp('trashed_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    unique('public_activities_id_ludo_id_unique').on(t.id, t.ludoId),
    unique('public_activities_ludo_slug_unique').on(t.ludoId, t.slug),
    uniqueIndex('public_activities_ludo_featured_rank_unique')
      .on(t.ludoId, t.featuredRank)
      .where(sql`${t.featuredRank} is not null`),
    foreignKey({
      columns: [t.authorMemberId, t.ludoId],
      foreignColumns: [members.id, members.ludoId],
      name: 'public_activities_author_tenant_fk',
    }),
    foreignKey({
      columns: [t.updatedByMemberId, t.ludoId],
      foreignColumns: [members.id, members.ludoId],
      name: 'public_activities_updated_by_tenant_fk',
    }),
    foreignKey({
      columns: [t.publishedByMemberId, t.ludoId],
      foreignColumns: [members.id, members.ludoId],
      name: 'public_activities_published_by_tenant_fk',
    }),
    check(
      'public_activities_publication_state_check',
      sql`(${t.status} = 'draft' and ${t.publishedAt} is null and ${t.publishedByMemberId} is null) or (${t.status} in ('published', 'hidden') and ${t.publishedAt} is not null and ${t.publishedByMemberId} is not null)`,
    ),
    check(
      'public_activities_lifecycle_check',
      sql`(${t.lifecycle} = 'active' and ${t.archivedAt} is null and ${t.trashedAt} is null) or (${t.lifecycle} = 'archived' and ${t.archivedAt} is not null and ${t.trashedAt} is null) or (${t.lifecycle} = 'trashed' and ${t.trashedAt} is not null)`,
    ),
    check(
      'public_activities_recurrence_check',
      sql`(${t.type} = 'recurring' and ${t.recurrenceRule} is not null and char_length(trim(${t.recurrenceRule})) between 1 and 1000) or (${t.type} <> 'recurring' and ${t.recurrenceRule} is null)`,
    ),
    check(
      'public_activities_featured_rank_check',
      sql`${t.featuredRank} is null or (${t.featuredRank} between 1 and 3 and ${t.status} = 'published' and ${t.lifecycle} = 'active')`,
    ),
    check(
      'public_activities_registration_capacity_check',
      sql`${t.registrationCapacity} is null or ${t.registrationCapacity} between 1 and 10000`,
    ),
    check('public_activities_slug_check', sql`char_length(${t.slug}) between 1 and 120`),
    check('public_activities_title_check', sql`char_length(trim(${t.title})) between 1 and 180`),
    check(
      'public_activities_summary_check',
      sql`char_length(trim(${t.summary})) between 1 and 500`,
    ),
    check('public_activities_body_check', sql`char_length(trim(${t.body})) between 1 and 50000`),
    check(
      'public_activities_image_check',
      sql`(${t.imageUrl} is null and ${t.imageStorageKey} is null and ${t.imageAlt} is null) or (${t.imageUrl} is not null and char_length(trim(${t.imageUrl})) between 1 and 2000 and ${t.imageStorageKey} is not null and char_length(trim(${t.imageStorageKey})) between 1 and 1000 and ${t.imageAlt} is not null and char_length(trim(${t.imageAlt})) between 1 and 300)`,
    ),
    index('public_activities_public_idx').on(t.ludoId, t.lifecycle, t.status, t.publishedAt.desc()),
  ],
)

export const publicActivitySites = pgTable(
  'public_activity_sites',
  {
    activityId: uuid('activity_id').notNull(),
    ludoId: uuid('ludo_id').notNull(),
    siteId: uuid('site_id').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.activityId, t.siteId] }),
    foreignKey({
      columns: [t.activityId, t.ludoId],
      foreignColumns: [publicActivities.id, publicActivities.ludoId],
      name: 'public_activity_sites_activity_tenant_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [t.siteId, t.ludoId],
      foreignColumns: [ludoSites.id, ludoSites.ludoId],
      name: 'public_activity_sites_site_tenant_fk',
    }),
  ],
)

export const publicActivityDates = pgTable(
  'public_activity_dates',
  {
    activityId: uuid('activity_id').notNull(),
    ludoId: uuid('ludo_id').notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.activityId, t.startsAt] }),
    foreignKey({
      columns: [t.activityId, t.ludoId],
      foreignColumns: [publicActivities.id, publicActivities.ludoId],
      name: 'public_activity_dates_activity_tenant_fk',
    }).onDelete('cascade'),
    check(
      'public_activity_dates_range_check',
      sql`${t.endsAt} is null or ${t.endsAt} > ${t.startsAt}`,
    ),
  ],
)

export const publicActivityExceptions = pgTable(
  'public_activity_exceptions',
  {
    activityId: uuid('activity_id').notNull(),
    ludoId: uuid('ludo_id').notNull(),
    excludedAt: timestamp('excluded_at', { withTimezone: true }).notNull(),
    reason: text('reason'),
  },
  (t) => [
    primaryKey({ columns: [t.activityId, t.excludedAt] }),
    foreignKey({
      columns: [t.activityId, t.ludoId],
      foreignColumns: [publicActivities.id, publicActivities.ludoId],
      name: 'public_activity_exceptions_activity_tenant_fk',
    }).onDelete('cascade'),
    check(
      'public_activity_exceptions_reason_check',
      sql`${t.reason} is null or char_length(trim(${t.reason})) between 1 and 500`,
    ),
  ],
)

export const publicActivityRegistrationStatus = pgEnum('public_activity_registration_status', [
  'received',
  'waitlisted',
  'confirmed',
  'declined',
  'cancelled',
  'archived',
])

/** Inscriptions publiques privées : aucune projection publique ne doit exposer ces PII. */
export const publicActivityRegistrations = pgTable(
  'public_activity_registrations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ludoId: uuid('ludo_id')
      .notNull()
      .references(() => ludotheques.id, { onDelete: 'cascade' }),
    activityId: uuid('activity_id').notNull(),
    idempotencyKeyHash: text('idempotency_key_hash').notNull(),
    requestFingerprint: text('request_fingerprint').notNull(),
    contactName: text('contact_name').notNull(),
    email: text('email').notNull(),
    phone: text('phone'),
    participantCount: integer('participant_count').notNull(),
    message: text('message'),
    status: publicActivityRegistrationStatus('status').notNull().default('received'),
    receiptStatus: publicActivityRegistrationStatus('receipt_status').notNull().default('received'),
    revision: integer('revision').notNull().default(1),
    handledByMemberId: uuid('handled_by_member_id'),
    handledAt: timestamp('handled_at'),
    archivedAt: timestamp('archived_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    unique('public_activity_registrations_id_ludo_id_unique').on(t.id, t.ludoId),
    unique('public_activity_registrations_ludo_idempotency_unique').on(
      t.ludoId,
      t.idempotencyKeyHash,
    ),
    foreignKey({
      columns: [t.activityId, t.ludoId],
      foreignColumns: [publicActivities.id, publicActivities.ludoId],
      name: 'public_activity_registrations_activity_tenant_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [t.handledByMemberId, t.ludoId],
      foreignColumns: [members.id, members.ludoId],
      name: 'public_activity_registrations_handler_tenant_fk',
    }),
    check(
      'public_activity_registrations_hash_check',
      sql`char_length(${t.idempotencyKeyHash}) = 64`,
    ),
    check(
      'public_activity_registrations_fingerprint_check',
      sql`char_length(${t.requestFingerprint}) = 64`,
    ),
    check(
      'public_activity_registrations_name_check',
      sql`char_length(trim(${t.contactName})) between 1 and 160`,
    ),
    check(
      'public_activity_registrations_email_check',
      sql`char_length(trim(${t.email})) between 3 and 320`,
    ),
    check(
      'public_activity_registrations_phone_check',
      sql`${t.phone} is null or char_length(trim(${t.phone})) between 3 and 50`,
    ),
    check(
      'public_activity_registrations_participant_count_check',
      sql`${t.participantCount} between 1 and 50`,
    ),
    check(
      'public_activity_registrations_message_check',
      sql`${t.message} is null or char_length(trim(${t.message})) between 1 and 2000`,
    ),
    check(
      'public_activity_registrations_handling_check',
      sql`(${t.handledByMemberId} is null and ${t.handledAt} is null) or (${t.handledByMemberId} is not null and ${t.handledAt} is not null)`,
    ),
    check(
      'public_activity_registrations_archive_check',
      sql`(${t.status} = 'archived' and ${t.archivedAt} is not null and ${t.handledByMemberId} is not null) or (${t.status} <> 'archived' and ${t.archivedAt} is null)`,
    ),
    check(
      'public_activity_registrations_receipt_status_check',
      sql`${t.receiptStatus} in ('received', 'waitlisted')`,
    ),
    index('public_activity_registrations_management_idx').on(
      t.ludoId,
      t.activityId,
      t.status,
      t.createdAt.desc(),
    ),
  ],
)

export const publicActivityRegistrationOutboxStatus = pgEnum(
  'public_activity_registration_outbox_status',
  ['pending', 'sent', 'failed', 'cancelled'],
)

/** File interne uniquement ; aucun worker d'envoi n'est activé dans ce lot. */
export const publicActivityRegistrationOutbox = pgTable(
  'public_activity_registration_outbox',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ludoId: uuid('ludo_id')
      .notNull()
      .references(() => ludotheques.id, { onDelete: 'cascade' }),
    registrationId: uuid('registration_id').notNull(),
    kind: text('kind').notNull().default('receipt'),
    recipientEmail: text('recipient_email').notNull(),
    status: publicActivityRegistrationOutboxStatus('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    lastErrorCode: text('last_error_code'),
    sentAt: timestamp('sent_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    unique('public_activity_registration_outbox_registration_kind_unique').on(
      t.registrationId,
      t.kind,
    ),
    foreignKey({
      columns: [t.registrationId, t.ludoId],
      foreignColumns: [publicActivityRegistrations.id, publicActivityRegistrations.ludoId],
      name: 'public_activity_registration_outbox_registration_tenant_fk',
    }).onDelete('cascade'),
    check('public_activity_registration_outbox_kind_check', sql`${t.kind} = 'receipt'`),
    check(
      'public_activity_registration_outbox_recipient_check',
      sql`char_length(trim(${t.recipientEmail})) between 3 and 320`,
    ),
    check('public_activity_registration_outbox_attempts_check', sql`${t.attempts} >= 0`),
    check(
      'public_activity_registration_outbox_state_check',
      sql`(${t.status} = 'sent' and ${t.sentAt} is not null) or (${t.status} <> 'sent' and ${t.sentAt} is null)`,
    ),
    index('public_activity_registration_outbox_pending_idx').on(t.status, t.createdAt),
  ],
)

// ─── Adhésion familiale publique ───────────────────────────────────────────

export const familyRegistrationSubmissionStatus = pgEnum('family_registration_submission_status', [
  'new',
  'processed',
])
export const familyRegistrationPaymentMethod = pgEnum('family_registration_payment_method', [
  'twint',
  'cash',
])
export const familyRegistrationGender = pgEnum('family_registration_gender', [
  'female',
  'male',
  'other',
  'unspecified',
])
export const familyRegistrationDocumentKind = pgEnum('family_registration_document_kind', [
  'rules',
  'contract',
  'privacy',
  'other',
])

/** Brouillon éditable. Une publication crée toujours une ligne de version immuable. */
export const familyRegistrationForms = pgTable(
  'family_registration_forms',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ludoId: uuid('ludo_id').notNull().references(() => ludotheques.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull().default('adhesion-famille'),
    title: text('title').notNull(),
    intro: text('intro'),
    consentLabel: text('consent_label'),
    annualFeeCents: integer('annual_fee_cents').notNull().default(3000),
    currency: text('currency').notNull().default('CHF'),
    allowsTwint: boolean('allows_twint').notNull().default(true),
    allowsCash: boolean('allows_cash').notNull().default(true),
    enabled: boolean('enabled').notNull().default(false),
    maxMembers: integer('max_members').notNull().default(20),
    retentionDays: integer('retention_days').notNull().default(30),
    revision: integer('revision').notNull().default(1),
    updatedByMemberId: uuid('updated_by_member_id'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    unique('family_registration_forms_id_ludo_unique').on(t.id, t.ludoId),
    unique('family_registration_forms_ludo_slug_unique').on(t.ludoId, t.slug),
    foreignKey({
      columns: [t.updatedByMemberId, t.ludoId],
      foreignColumns: [members.id, members.ludoId],
      name: 'family_registration_forms_updater_tenant_fk',
    }),
    check('family_registration_forms_max_members_check', sql`${t.maxMembers} between 1 and 50`),
    check('family_registration_forms_retention_check', sql`${t.retentionDays} between 1 and 365`),
    check('family_registration_forms_fee_check', sql`${t.annualFeeCents} between 0 and 1000000`),
    check('family_registration_forms_currency_check', sql`${t.currency} = 'CHF'`),
    check('family_registration_forms_payment_methods_check', sql`${t.allowsTwint} or ${t.allowsCash}`),
  ],
)

export const familyRegistrationDocuments = pgTable(
  'family_registration_documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ludoId: uuid('ludo_id').notNull().references(() => ludotheques.id, { onDelete: 'cascade' }),
    formId: uuid('form_id').notNull(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    kind: familyRegistrationDocumentKind('kind').notNull().default('other'),
    requiredAcceptance: boolean('required_acceptance').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    revision: integer('revision').notNull().default(1),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    unique('family_registration_documents_id_ludo_unique').on(t.id, t.ludoId),
    unique('family_registration_documents_form_slug_unique').on(t.formId, t.slug),
    foreignKey({
      columns: [t.formId, t.ludoId],
      foreignColumns: [familyRegistrationForms.id, familyRegistrationForms.ludoId],
      name: 'family_registration_documents_form_tenant_fk',
    }).onDelete('cascade'),
  ],
)

/** Contenu légal versionné et hashé; aucune ligne publiée n'est mise à jour. */
export const familyRegistrationDocumentVersions = pgTable(
  'family_registration_document_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ludoId: uuid('ludo_id').notNull().references(() => ludotheques.id, { onDelete: 'cascade' }),
    documentId: uuid('document_id').notNull(),
    version: integer('version').notNull(),
    title: text('title').notNull(),
    kind: familyRegistrationDocumentKind('kind').notNull(),
    requiredAcceptance: boolean('required_acceptance').notNull(),
    contentMarkdown: text('content_markdown').notNull(),
    sha256: text('sha256').notNull(),
    createdByMemberId: uuid('created_by_member_id').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    unique('family_registration_document_versions_id_ludo_unique').on(t.id, t.ludoId),
    unique('family_registration_document_versions_document_version_unique').on(
      t.documentId,
      t.version,
    ),
    foreignKey({
      columns: [t.documentId, t.ludoId],
      foreignColumns: [familyRegistrationDocuments.id, familyRegistrationDocuments.ludoId],
      name: 'family_registration_document_versions_document_tenant_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [t.createdByMemberId, t.ludoId],
      foreignColumns: [members.id, members.ludoId],
      name: 'family_registration_document_versions_author_tenant_fk',
    }),
    check('family_registration_document_versions_version_check', sql`${t.version} >= 1`),
    check('family_registration_document_versions_hash_check', sql`char_length(${t.sha256}) = 64`),
  ],
)

export const familyRegistrationFormVersions = pgTable(
  'family_registration_form_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ludoId: uuid('ludo_id').notNull().references(() => ludotheques.id, { onDelete: 'cascade' }),
    formId: uuid('form_id').notNull(),
    version: integer('version').notNull(),
    title: text('title').notNull(),
    intro: text('intro'),
    consentLabel: text('consent_label').notNull(),
    maxMembers: integer('max_members').notNull(),
    retentionDays: integer('retention_days').notNull(),
    annualFeeCents: integer('annual_fee_cents').notNull(),
    currency: text('currency').notNull(),
    allowsTwint: boolean('allows_twint').notNull(),
    allowsCash: boolean('allows_cash').notNull(),
    publishedByMemberId: uuid('published_by_member_id').notNull(),
    publishedAt: timestamp('published_at').notNull(),
  },
  (t) => [
    unique('family_registration_form_versions_id_ludo_unique').on(t.id, t.ludoId),
    unique('family_registration_form_versions_id_ludo_form_unique').on(t.id, t.ludoId, t.formId),
    unique('family_registration_form_versions_form_version_unique').on(t.formId, t.version),
    foreignKey({
      columns: [t.formId, t.ludoId],
      foreignColumns: [familyRegistrationForms.id, familyRegistrationForms.ludoId],
      name: 'family_registration_form_versions_form_tenant_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [t.publishedByMemberId, t.ludoId],
      foreignColumns: [members.id, members.ludoId],
      name: 'family_registration_form_versions_publisher_tenant_fk',
    }),
    check('family_registration_form_versions_max_members_check', sql`${t.maxMembers} between 1 and 50`),
    check('family_registration_form_versions_retention_check', sql`${t.retentionDays} between 1 and 365`),
    check('family_registration_form_versions_fee_check', sql`${t.annualFeeCents} between 0 and 1000000`),
    check('family_registration_form_versions_currency_check', sql`${t.currency} = 'CHF'`),
    check('family_registration_form_versions_payment_methods_check', sql`${t.allowsTwint} or ${t.allowsCash}`),
  ],
)

export const familyRegistrationFormVersionDocuments = pgTable(
  'family_registration_form_version_documents',
  {
    formVersionId: uuid('form_version_id').notNull(),
    documentVersionId: uuid('document_version_id').notNull(),
    ludoId: uuid('ludo_id').notNull().references(() => ludotheques.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.formVersionId, t.documentVersionId] }),
    foreignKey({
      columns: [t.formVersionId, t.ludoId],
      foreignColumns: [familyRegistrationFormVersions.id, familyRegistrationFormVersions.ludoId],
      name: 'family_registration_version_documents_form_tenant_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [t.documentVersionId, t.ludoId],
      foreignColumns: [
        familyRegistrationDocumentVersions.id,
        familyRegistrationDocumentVersions.ludoId,
      ],
      name: 'family_registration_version_documents_document_tenant_fk',
    }),
  ],
)

/** Ledger non-PII durable : permet un rejeu exact même après purge de la famille. */
export const familySubmissionReceipts = pgTable(
  'family_submission_receipts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ludoId: uuid('ludo_id').notNull().references(() => ludotheques.id, { onDelete: 'cascade' }),
    idempotencyKeyHash: text('idempotency_key_hash').notNull(),
    requestFingerprint: text('request_fingerprint').notNull(),
    receiptId: uuid('receipt_id').notNull(),
    submittedAt: timestamp('submitted_at').notNull(),
    purgedAt: timestamp('purged_at'),
  },
  (t) => [
    unique('family_submission_receipts_ludo_key_unique').on(t.ludoId, t.idempotencyKeyHash),
    unique('family_submission_receipts_ludo_receipt_unique').on(t.ludoId, t.receiptId),
    unique('family_submission_receipts_receipt_ludo_unique').on(t.receiptId, t.ludoId),
    check('family_submission_receipts_key_hash_check', sql`char_length(${t.idempotencyKeyHash}) = 64`),
    check('family_submission_receipts_fingerprint_check', sql`char_length(${t.requestFingerprint}) = 64`),
  ],
)

export const familyRegistrationSubmissions = pgTable(
  'family_registration_submissions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ludoId: uuid('ludo_id').notNull().references(() => ludotheques.id, { onDelete: 'cascade' }),
    formId: uuid('form_id').notNull(),
    formVersionId: uuid('form_version_id').notNull(),
    siteId: uuid('site_id').notNull(),
    gender: familyRegistrationGender('gender').notNull().default('unspecified'),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    birthDate: date('birth_date'),
    address: text('address').notNull(),
    postalCode: text('postal_code').notNull(),
    city: text('city').notNull(),
    phone: text('phone').notNull(),
    secondaryPhone: text('secondary_phone'),
    email: text('email').notNull(),
    consentAccepted: boolean('consent_accepted').notNull(),
    consentFullName: text('consent_full_name').notNull(),
    consentAcceptedOn: date('consent_accepted_on').notNull(),
    consentAcceptedAt: timestamp('consent_accepted_at').notNull(),
    consentLabelSnapshot: text('consent_label_snapshot').notNull(),
    consentDocumentsSnapshot: jsonb('consent_documents_snapshot').notNull(),
    status: familyRegistrationSubmissionStatus('status').notNull().default('new'),
    paymentMethod: familyRegistrationPaymentMethod('payment_method'),
    paymentRecordedAt: timestamp('payment_recorded_at'),
    paymentRecordedByMemberId: uuid('payment_recorded_by_member_id'),
    revision: integer('revision').notNull().default(1),
    processedByMemberId: uuid('processed_by_member_id'),
    processedAt: timestamp('processed_at'),
    purgeAt: timestamp('purge_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    unique('family_registration_submissions_id_ludo_unique').on(t.id, t.ludoId),
    foreignKey({ columns: [t.id, t.ludoId], foreignColumns: [familySubmissionReceipts.receiptId, familySubmissionReceipts.ludoId], name: 'family_registration_submissions_receipt_tenant_fk' }),
    foreignKey({ columns: [t.formId, t.ludoId], foreignColumns: [familyRegistrationForms.id, familyRegistrationForms.ludoId], name: 'family_registration_submissions_form_tenant_fk' }),
    foreignKey({ columns: [t.formVersionId, t.ludoId, t.formId], foreignColumns: [familyRegistrationFormVersions.id, familyRegistrationFormVersions.ludoId, familyRegistrationFormVersions.formId], name: 'family_registration_submissions_version_form_tenant_fk' }),
    foreignKey({ columns: [t.siteId, t.ludoId], foreignColumns: [ludoSites.id, ludoSites.ludoId], name: 'family_registration_submissions_site_tenant_fk' }),
    foreignKey({ columns: [t.processedByMemberId, t.ludoId], foreignColumns: [members.id, members.ludoId], name: 'family_registration_submissions_processor_tenant_fk' }),
    foreignKey({ columns: [t.paymentRecordedByMemberId, t.ludoId], foreignColumns: [members.id, members.ludoId], name: 'family_registration_submissions_payment_recorder_tenant_fk' }),
    check('family_registration_submissions_consent_check', sql`${t.consentAccepted} = true`),
    check('family_registration_submissions_process_check', sql`(${t.status} = 'new' and ${t.processedAt} is null and ${t.purgeAt} is null and ${t.processedByMemberId} is null) or (${t.status} = 'processed' and ${t.processedAt} is not null and ${t.purgeAt} is not null and ${t.processedByMemberId} is not null)`),
    check('family_registration_submissions_payment_check', sql`(${t.paymentMethod} is null and ${t.paymentRecordedAt} is null and ${t.paymentRecordedByMemberId} is null) or (${t.paymentMethod} is not null and ${t.paymentRecordedAt} is not null and ${t.paymentRecordedByMemberId} is not null)`),
    index('family_registration_submissions_management_idx').on(t.ludoId, t.status, t.createdAt.desc()),
    index('family_registration_submissions_purge_idx').on(t.status, t.purgeAt),
  ],
)

export const familyRegistrationSubmissionMembers = pgTable(
  'family_registration_submission_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ludoId: uuid('ludo_id').notNull(),
    submissionId: uuid('submission_id').notNull(),
    gender: familyRegistrationGender('gender').notNull().default('unspecified'),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    birthDate: date('birth_date'),
    sortOrder: integer('sort_order').notNull(),
  },
  (t) => [
    foreignKey({ columns: [t.submissionId, t.ludoId], foreignColumns: [familyRegistrationSubmissions.id, familyRegistrationSubmissions.ludoId], name: 'family_registration_submission_members_submission_tenant_fk' }).onDelete('cascade'),
    unique('family_registration_submission_members_submission_order_unique').on(t.submissionId, t.sortOrder),
  ],
)

/** Agrégat journalier non-PII; aucune ligne ne reste reliée à une famille purgée. */
export const familyProcessingDailyStats = pgTable(
  'family_processing_daily_stats',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ludoId: uuid('ludo_id').notNull().references(() => ludotheques.id, { onDelete: 'cascade' }),
    siteId: uuid('site_id').notNull(),
    processedOn: date('processed_on').notNull(),
    submissionsCount: integer('submissions_count').notNull().default(0),
    personsCount: integer('persons_count').notNull().default(0),
    twintCount: integer('twint_count').notNull().default(0),
    cashCount: integer('cash_count').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    unique('family_processing_daily_stats_ludo_site_date_unique').on(
      t.ludoId,
      t.siteId,
      t.processedOn,
    ),
    foreignKey({ columns: [t.siteId, t.ludoId], foreignColumns: [ludoSites.id, ludoSites.ludoId], name: 'family_processing_daily_stats_site_tenant_fk' }),
    check('family_processing_daily_stats_counts_check', sql`${t.submissionsCount} >= 0 and ${t.personsCount} >= 0 and ${t.twintCount} >= 0 and ${t.cashCount} >= 0`),
  ],
)

// ─── Planning ────────────────────────────────────────────────────────────────

export const seasons = pgTable('seasons', {
  id: uuid('id').defaultRandom().primaryKey(),
  ludoId: uuid('ludo_id')
    .notNull()
    .references(() => ludotheques.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  isActive: boolean('is_active').notNull().default(false),
  isArchived: boolean('is_archived').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const slotType = pgEnum('slot_type', ['normal', 'annule'])

export const saturdaySlots = pgTable('saturday_slots', {
  id: uuid('id').defaultRandom().primaryKey(),
  seasonId: uuid('season_id')
    .notNull()
    .references(() => seasons.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  type: slotType('type').notNull().default('normal'),
  requiredCount: integer('required_count').notNull().default(3),
  isCancelled: boolean('is_cancelled').notNull().default(false),
})

export const assignments = pgTable(
  'assignments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slotId: uuid('slot_id')
      .notNull()
      .references(() => saturdaySlots.id, { onDelete: 'cascade' }),
    memberId: uuid('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
  },
  (t) => [unique().on(t.slotId, t.memberId)],
)

/**
 * Plages de fermeture / vacances saisies par le responsable, par saison.
 * Un samedi tombant dans une plage est affiché « fermé » (bg vacances, hors
 * effectif). On ne supprime pas le slot : on l'annote au moment du rendu.
 */
export const closurePeriods = pgTable('closure_periods', {
  id: uuid('id').defaultRandom().primaryKey(),
  seasonId: uuid('season_id')
    .notNull()
    .references(() => seasons.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

/**
 * Configuration par membre pour une saison donnée.
 * `isPermanent` = travaille tous les samedis non fermés/fériés de la saison.
 * Utilisé par l'algo de génération automatique du planning.
 */
export const seasonMemberSettings = pgTable(
  'season_member_settings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    seasonId: uuid('season_id')
      .notNull()
      .references(() => seasons.id, { onDelete: 'cascade' }),
    memberId: uuid('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    isPermanent: boolean('is_permanent').notNull().default(false),
  },
  (t) => [unique().on(t.seasonId, t.memberId)],
)

// ─── Relations (API relationnelle Drizzle : `db.query.*.findMany({ with })`) ──

export const membersRelations = relations(members, ({ many }) => ({
  assignments: many(assignments),
  absences: many(absences),
  seasonSettings: many(seasonMemberSettings),
  authoredPublicAnnouncements: many(publicAnnouncements, {
    relationName: 'publicAnnouncementAuthor',
  }),
  updatedPublicAnnouncements: many(publicAnnouncements, {
    relationName: 'publicAnnouncementUpdater',
  }),
  publishedPublicAnnouncements: many(publicAnnouncements, {
    relationName: 'publicAnnouncementPublisher',
  }),
  authoredPublicNews: many(publicNews, { relationName: 'publicNewsAuthor' }),
  updatedPublicNews: many(publicNews, { relationName: 'publicNewsUpdater' }),
  publishedPublicNews: many(publicNews, { relationName: 'publicNewsPublisher' }),
  authoredPublicActivities: many(publicActivities, { relationName: 'publicActivityAuthor' }),
  updatedPublicActivities: many(publicActivities, { relationName: 'publicActivityUpdater' }),
  publishedPublicActivities: many(publicActivities, { relationName: 'publicActivityPublisher' }),
  authoredPublicTopThrees: many(publicTopThrees, { relationName: 'publicTopThreeAuthor' }),
  updatedPublicTopThrees: many(publicTopThrees, { relationName: 'publicTopThreeUpdater' }),
  publishedPublicTopThrees: many(publicTopThrees, { relationName: 'publicTopThreePublisher' }),
  authoredPublicFaqs: many(publicFaqs, { relationName: 'publicFaqAuthor' }),
  updatedPublicFaqs: many(publicFaqs, { relationName: 'publicFaqUpdater' }),
  publishedPublicFaqs: many(publicFaqs, { relationName: 'publicFaqPublisher' }),
  authoredPublicDocuments: many(publicDocuments, { relationName: 'publicDocumentAuthor' }),
  updatedPublicDocuments: many(publicDocuments, { relationName: 'publicDocumentUpdater' }),
  publishedPublicDocuments: many(publicDocuments, { relationName: 'publicDocumentPublisher' }),
  authoredPublicGalleryImages: many(publicGalleryImages, {
    relationName: 'publicGalleryImageAuthor',
  }),
  updatedPublicGalleryImages: many(publicGalleryImages, {
    relationName: 'publicGalleryImageUpdater',
  }),
  publishedPublicGalleryImages: many(publicGalleryImages, {
    relationName: 'publicGalleryImagePublisher',
  }),
  linkedPublicProfiles: many(publicProfiles, { relationName: 'publicProfileMember' }),
  authoredPublicProfiles: many(publicProfiles, { relationName: 'publicProfileAuthor' }),
  updatedPublicProfiles: many(publicProfiles, { relationName: 'publicProfileUpdater' }),
  publishedPublicProfiles: many(publicProfiles, { relationName: 'publicProfilePublisher' }),
  authoredPublicDirectoryEntries: many(publicDirectoryEntries, {
    relationName: 'publicDirectoryAuthor',
  }),
  updatedPublicDirectoryEntries: many(publicDirectoryEntries, {
    relationName: 'publicDirectoryUpdater',
  }),
  publishedPublicDirectoryEntries: many(publicDirectoryEntries, {
    relationName: 'publicDirectoryPublisher',
  }),
  handledPublicContactMessages: many(publicContactMessages, {
    relationName: 'publicContactHandler',
  }),
  handledPublicActivityRegistrations: many(publicActivityRegistrations, {
    relationName: 'publicActivityRegistrationHandler',
  }),
}))

export const seasonsRelations = relations(seasons, ({ many }) => ({
  slots: many(saturdaySlots),
  closurePeriods: many(closurePeriods),
  memberSettings: many(seasonMemberSettings),
}))

export const seasonMemberSettingsRelations = relations(seasonMemberSettings, ({ one }) => ({
  season: one(seasons, {
    fields: [seasonMemberSettings.seasonId],
    references: [seasons.id],
  }),
  member: one(members, {
    fields: [seasonMemberSettings.memberId],
    references: [members.id],
  }),
}))

export const closurePeriodsRelations = relations(closurePeriods, ({ one }) => ({
  season: one(seasons, {
    fields: [closurePeriods.seasonId],
    references: [seasons.id],
  }),
}))

export const saturdaySlotsRelations = relations(saturdaySlots, ({ one, many }) => ({
  season: one(seasons, {
    fields: [saturdaySlots.seasonId],
    references: [seasons.id],
  }),
  assignments: many(assignments),
}))

export const assignmentsRelations = relations(assignments, ({ one }) => ({
  slot: one(saturdaySlots, {
    fields: [assignments.slotId],
    references: [saturdaySlots.id],
  }),
  member: one(members, {
    fields: [assignments.memberId],
    references: [members.id],
  }),
}))

// ─── Absences ────────────────────────────────────────────────────────────────

export const absenceType = pgEnum('absence_type', [
  'conge',
  'vacances',
  'formation',
  'indisponible',
])

export const absenceStatus = pgEnum('absence_status', ['en_attente', 'approuve', 'refuse'])

export const absences = pgTable('absences', {
  id: uuid('id').defaultRandom().primaryKey(),
  ludoId: uuid('ludo_id')
    .notNull()
    .references(() => ludotheques.id, { onDelete: 'cascade' }),
  memberId: uuid('member_id')
    .notNull()
    .references(() => members.id, { onDelete: 'cascade' }),
  type: absenceType('type').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  status: absenceStatus('status').notNull().default('en_attente'),
  notes: text('notes'),
  responderNotes: text('responder_notes'),
  respondedBy: uuid('responded_by').references(() => members.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const absencesRelations = relations(absences, ({ one }) => ({
  member: one(members, {
    fields: [absences.memberId],
    references: [members.id],
  }),
}))

// ─── Fréquentation ─────────────────────────────────────────────────────────────

export const attendancePeriod = pgEnum('attendance_period', ['matin', 'apres_midi', 'evenement'])

export const weatherCondition = pgEnum('weather_condition', ['beau', 'gris', 'pluie', 'neige'])

export const attendanceRecords = pgTable(
  'attendance_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ludoId: uuid('ludo_id')
      .notNull()
      .references(() => ludotheques.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    period: attendancePeriod('period').notNull(),
    // Libellé de l'événement : snapshot du nom du type choisi, ou saisie libre
    // (« Autre »). Requis uniquement pour la période `evenement`, sinon null.
    eventLabel: text('event_label'),
    // Type d'événement choisi parmi le référentiel de la ludo (null si « Autre »
    // ou hors `evenement`). Set null si le type est supprimé : `eventLabel` reste.
    eventTypeId: uuid('event_type_id').references(() => eventTypes.id, { onDelete: 'set null' }),
    adultsCount: integer('adults_count').notNull().default(0),
    childrenCount: integer('children_count').notNull().default(0),
    loansCount: integer('loans_count').notNull().default(0),
    returnsCount: integer('returns_count').notNull().default(0),
    weather: weatherCondition('weather'),
    temperature: integer('temperature'),
    // Site physique de la séance, pour les ludos multi-sites (config en dur dans
    // `src/lib/server/sites.ts`, ex. Pâquis-Sécheron). `null` = ludo mono-site ou
    // séance « non répartie » (historique antérieur à la distinction par site).
    site: text('site'),
    // Référence normalisée ; `site` reste pendant la fenêtre de dual-read/write.
    siteId: uuid('site_id'),
    // FK informatif : qui a clôturé la séance. Set null si le membre est supprimé.
    closedByMemberId: uuid('closed_by_member_id').references(() => members.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    // Un seul `matin` / `apres_midi` par jour, par ludo et par site ; les
    // `evenement` restent libres (plusieurs événements possibles le même jour).
    // `coalesce(site, '')` neutralise le null (sinon Postgres traite chaque null
    // comme distinct) : ludo mono-site → clé inchangée (1 créneau/jour) ; ludo
    // multi-site → un créneau par site (Pâquis et Sécheron coexistent le même jour).
    uniqueIndex('attendance_unique_slot')
      .on(t.ludoId, t.date, t.period, sql`coalesce(${t.site}, '')`)
      .where(sql`${t.period} <> 'evenement'`),
    foreignKey({
      columns: [t.siteId, t.ludoId],
      foreignColumns: [ludoSites.id, ludoSites.ludoId],
      name: 'attendance_records_site_tenant_fk',
    }).onDelete('restrict'),
  ],
)

// Référentiel de types d'événement propre à chaque ludo (« soirée jeu »,
// « anniversaire »…). Référencé par `attendance_records.eventTypeId`.
export const eventTypes = pgTable(
  'event_types',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ludoId: uuid('ludo_id')
      .notNull()
      .references(() => ludotheques.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    isArchived: boolean('is_archived').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  // Unicité du nom par ludo, insensible à la casse.
  (t) => [uniqueIndex('event_types_ludo_name_idx').on(t.ludoId, sql`lower(${t.name})`)],
)

export const attendanceRecordsRelations = relations(attendanceRecords, ({ one }) => ({
  siteRecord: one(ludoSites, {
    fields: [attendanceRecords.siteId],
    references: [ludoSites.id],
  }),
  closedBy: one(members, {
    fields: [attendanceRecords.closedByMemberId],
    references: [members.id],
  }),
  eventType: one(eventTypes, {
    fields: [attendanceRecords.eventTypeId],
    references: [eventTypes.id],
  }),
}))

export const ludoSitesRelations = relations(ludoSites, ({ one, many }) => ({
  ludo: one(ludotheques, {
    fields: [ludoSites.ludoId],
    references: [ludotheques.id],
  }),
  openingIntervals: many(siteOpeningIntervals),
  attendanceRecords: many(attendanceRecords),
  publicAnnouncementTargets: many(publicAnnouncementSites),
  publicNewsTargets: many(publicNewsSites),
  publicActivityTargets: many(publicActivitySites),
  publicTopThreeTargets: many(publicTopThreeSites),
  publicFaqTargets: many(publicFaqSites),
  publicDocumentTargets: many(publicDocumentSites),
  publicGalleryImageTargets: many(publicGalleryImageSites),
  publicProfileTargets: many(publicProfileSites),
}))

export const siteOpeningIntervalsRelations = relations(siteOpeningIntervals, ({ one }) => ({
  site: one(ludoSites, {
    fields: [siteOpeningIntervals.siteId],
    references: [ludoSites.id],
  }),
}))

export const publicSiteSettingsRelations = relations(publicSiteSettings, ({ one }) => ({
  ludo: one(ludotheques, {
    fields: [publicSiteSettings.ludoId],
    references: [ludotheques.id],
  }),
}))

export const publicAnnouncementsRelations = relations(publicAnnouncements, ({ one, many }) => ({
  ludo: one(ludotheques, {
    fields: [publicAnnouncements.ludoId],
    references: [ludotheques.id],
  }),
  author: one(members, {
    fields: [publicAnnouncements.authorMemberId, publicAnnouncements.ludoId],
    references: [members.id, members.ludoId],
    relationName: 'publicAnnouncementAuthor',
  }),
  updatedBy: one(members, {
    fields: [publicAnnouncements.updatedByMemberId, publicAnnouncements.ludoId],
    references: [members.id, members.ludoId],
    relationName: 'publicAnnouncementUpdater',
  }),
  publishedBy: one(members, {
    fields: [publicAnnouncements.publishedByMemberId, publicAnnouncements.ludoId],
    references: [members.id, members.ludoId],
    relationName: 'publicAnnouncementPublisher',
  }),
  targets: many(publicAnnouncementSites),
}))

export const publicAnnouncementSitesRelations = relations(publicAnnouncementSites, ({ one }) => ({
  announcement: one(publicAnnouncements, {
    fields: [publicAnnouncementSites.announcementId, publicAnnouncementSites.ludoId],
    references: [publicAnnouncements.id, publicAnnouncements.ludoId],
  }),
  site: one(ludoSites, {
    fields: [publicAnnouncementSites.siteId, publicAnnouncementSites.ludoId],
    references: [ludoSites.id, ludoSites.ludoId],
  }),
}))

export const publicNewsRelations = relations(publicNews, ({ one, many }) => ({
  ludo: one(ludotheques, {
    fields: [publicNews.ludoId],
    references: [ludotheques.id],
  }),
  author: one(members, {
    fields: [publicNews.authorMemberId, publicNews.ludoId],
    references: [members.id, members.ludoId],
    relationName: 'publicNewsAuthor',
  }),
  updatedBy: one(members, {
    fields: [publicNews.updatedByMemberId, publicNews.ludoId],
    references: [members.id, members.ludoId],
    relationName: 'publicNewsUpdater',
  }),
  publishedBy: one(members, {
    fields: [publicNews.publishedByMemberId, publicNews.ludoId],
    references: [members.id, members.ludoId],
    relationName: 'publicNewsPublisher',
  }),
  targets: many(publicNewsSites),
}))

export const publicNewsSitesRelations = relations(publicNewsSites, ({ one }) => ({
  news: one(publicNews, {
    fields: [publicNewsSites.newsId, publicNewsSites.ludoId],
    references: [publicNews.id, publicNews.ludoId],
  }),
  site: one(ludoSites, {
    fields: [publicNewsSites.siteId, publicNewsSites.ludoId],
    references: [ludoSites.id, ludoSites.ludoId],
  }),
}))

export const publicTopThreesRelations = relations(publicTopThrees, ({ one, many }) => ({
  ludo: one(ludotheques, { fields: [publicTopThrees.ludoId], references: [ludotheques.id] }),
  author: one(members, {
    fields: [publicTopThrees.authorMemberId, publicTopThrees.ludoId],
    references: [members.id, members.ludoId],
    relationName: 'publicTopThreeAuthor',
  }),
  updatedBy: one(members, {
    fields: [publicTopThrees.updatedByMemberId, publicTopThrees.ludoId],
    references: [members.id, members.ludoId],
    relationName: 'publicTopThreeUpdater',
  }),
  publishedBy: one(members, {
    fields: [publicTopThrees.publishedByMemberId, publicTopThrees.ludoId],
    references: [members.id, members.ludoId],
    relationName: 'publicTopThreePublisher',
  }),
  targets: many(publicTopThreeSites),
}))

export const publicTopThreeSitesRelations = relations(publicTopThreeSites, ({ one }) => ({
  topThree: one(publicTopThrees, {
    fields: [publicTopThreeSites.topThreeId, publicTopThreeSites.ludoId],
    references: [publicTopThrees.id, publicTopThrees.ludoId],
  }),
  site: one(ludoSites, {
    fields: [publicTopThreeSites.siteId, publicTopThreeSites.ludoId],
    references: [ludoSites.id, ludoSites.ludoId],
  }),
}))

export const publicFaqsRelations = relations(publicFaqs, ({ one, many }) => ({
  ludo: one(ludotheques, { fields: [publicFaqs.ludoId], references: [ludotheques.id] }),
  author: one(members, {
    fields: [publicFaqs.authorMemberId, publicFaqs.ludoId],
    references: [members.id, members.ludoId],
    relationName: 'publicFaqAuthor',
  }),
  updatedBy: one(members, {
    fields: [publicFaqs.updatedByMemberId, publicFaqs.ludoId],
    references: [members.id, members.ludoId],
    relationName: 'publicFaqUpdater',
  }),
  publishedBy: one(members, {
    fields: [publicFaqs.publishedByMemberId, publicFaqs.ludoId],
    references: [members.id, members.ludoId],
    relationName: 'publicFaqPublisher',
  }),
  targets: many(publicFaqSites),
}))

export const publicFaqSitesRelations = relations(publicFaqSites, ({ one }) => ({
  faq: one(publicFaqs, {
    fields: [publicFaqSites.faqId, publicFaqSites.ludoId],
    references: [publicFaqs.id, publicFaqs.ludoId],
  }),
  site: one(ludoSites, {
    fields: [publicFaqSites.siteId, publicFaqSites.ludoId],
    references: [ludoSites.id, ludoSites.ludoId],
  }),
}))

export const publicDocumentsRelations = relations(publicDocuments, ({ one, many }) => ({
  ludo: one(ludotheques, { fields: [publicDocuments.ludoId], references: [ludotheques.id] }),
  author: one(members, {
    fields: [publicDocuments.authorMemberId, publicDocuments.ludoId],
    references: [members.id, members.ludoId],
    relationName: 'publicDocumentAuthor',
  }),
  updatedBy: one(members, {
    fields: [publicDocuments.updatedByMemberId, publicDocuments.ludoId],
    references: [members.id, members.ludoId],
    relationName: 'publicDocumentUpdater',
  }),
  publishedBy: one(members, {
    fields: [publicDocuments.publishedByMemberId, publicDocuments.ludoId],
    references: [members.id, members.ludoId],
    relationName: 'publicDocumentPublisher',
  }),
  targets: many(publicDocumentSites),
}))

export const publicDocumentSitesRelations = relations(publicDocumentSites, ({ one }) => ({
  document: one(publicDocuments, {
    fields: [publicDocumentSites.documentId, publicDocumentSites.ludoId],
    references: [publicDocuments.id, publicDocuments.ludoId],
  }),
  site: one(ludoSites, {
    fields: [publicDocumentSites.siteId, publicDocumentSites.ludoId],
    references: [ludoSites.id, ludoSites.ludoId],
  }),
}))

export const publicGalleryImagesRelations = relations(publicGalleryImages, ({ one, many }) => ({
  author: one(members, {
    fields: [publicGalleryImages.authorMemberId, publicGalleryImages.ludoId],
    references: [members.id, members.ludoId],
    relationName: 'publicGalleryImageAuthor',
  }),
  updatedBy: one(members, {
    fields: [publicGalleryImages.updatedByMemberId, publicGalleryImages.ludoId],
    references: [members.id, members.ludoId],
    relationName: 'publicGalleryImageUpdater',
  }),
  publishedBy: one(members, {
    fields: [publicGalleryImages.publishedByMemberId, publicGalleryImages.ludoId],
    references: [members.id, members.ludoId],
    relationName: 'publicGalleryImagePublisher',
  }),
  targets: many(publicGalleryImageSites),
}))
export const publicGalleryImageSitesRelations = relations(publicGalleryImageSites, ({ one }) => ({
  image: one(publicGalleryImages, {
    fields: [publicGalleryImageSites.imageId, publicGalleryImageSites.ludoId],
    references: [publicGalleryImages.id, publicGalleryImages.ludoId],
  }),
  site: one(ludoSites, {
    fields: [publicGalleryImageSites.siteId, publicGalleryImageSites.ludoId],
    references: [ludoSites.id, ludoSites.ludoId],
  }),
}))
export const publicProfilesRelations = relations(publicProfiles, ({ one, many }) => ({
  member: one(members, {
    fields: [publicProfiles.memberId, publicProfiles.ludoId],
    references: [members.id, members.ludoId],
    relationName: 'publicProfileMember',
  }),
  author: one(members, {
    fields: [publicProfiles.authorMemberId, publicProfiles.ludoId],
    references: [members.id, members.ludoId],
    relationName: 'publicProfileAuthor',
  }),
  updatedBy: one(members, {
    fields: [publicProfiles.updatedByMemberId, publicProfiles.ludoId],
    references: [members.id, members.ludoId],
    relationName: 'publicProfileUpdater',
  }),
  publishedBy: one(members, {
    fields: [publicProfiles.publishedByMemberId, publicProfiles.ludoId],
    references: [members.id, members.ludoId],
    relationName: 'publicProfilePublisher',
  }),
  targets: many(publicProfileSites),
}))
export const publicProfileSitesRelations = relations(publicProfileSites, ({ one }) => ({
  profile: one(publicProfiles, {
    fields: [publicProfileSites.profileId, publicProfileSites.ludoId],
    references: [publicProfiles.id, publicProfiles.ludoId],
  }),
  site: one(ludoSites, {
    fields: [publicProfileSites.siteId, publicProfileSites.ludoId],
    references: [ludoSites.id, ludoSites.ludoId],
  }),
}))
export const publicDirectoryEntriesRelations = relations(publicDirectoryEntries, ({ one }) => ({
  author: one(members, {
    fields: [publicDirectoryEntries.authorMemberId, publicDirectoryEntries.ludoId],
    references: [members.id, members.ludoId],
    relationName: 'publicDirectoryAuthor',
  }),
  updatedBy: one(members, {
    fields: [publicDirectoryEntries.updatedByMemberId, publicDirectoryEntries.ludoId],
    references: [members.id, members.ludoId],
    relationName: 'publicDirectoryUpdater',
  }),
  publishedBy: one(members, {
    fields: [publicDirectoryEntries.publishedByMemberId, publicDirectoryEntries.ludoId],
    references: [members.id, members.ludoId],
    relationName: 'publicDirectoryPublisher',
  }),
}))
export const publicContactMessagesRelations = relations(publicContactMessages, ({ one }) => ({
  handler: one(members, {
    fields: [publicContactMessages.handledByMemberId, publicContactMessages.ludoId],
    references: [members.id, members.ludoId],
    relationName: 'publicContactHandler',
  }),
}))

export const publicActivitiesRelations = relations(publicActivities, ({ one, many }) => ({
  ludo: one(ludotheques, {
    fields: [publicActivities.ludoId],
    references: [ludotheques.id],
  }),
  author: one(members, {
    fields: [publicActivities.authorMemberId, publicActivities.ludoId],
    references: [members.id, members.ludoId],
    relationName: 'publicActivityAuthor',
  }),
  updatedBy: one(members, {
    fields: [publicActivities.updatedByMemberId, publicActivities.ludoId],
    references: [members.id, members.ludoId],
    relationName: 'publicActivityUpdater',
  }),
  publishedBy: one(members, {
    fields: [publicActivities.publishedByMemberId, publicActivities.ludoId],
    references: [members.id, members.ludoId],
    relationName: 'publicActivityPublisher',
  }),
  targets: many(publicActivitySites),
  dates: many(publicActivityDates),
  exceptions: many(publicActivityExceptions),
  registrations: many(publicActivityRegistrations),
}))

export const publicActivitySitesRelations = relations(publicActivitySites, ({ one }) => ({
  activity: one(publicActivities, {
    fields: [publicActivitySites.activityId, publicActivitySites.ludoId],
    references: [publicActivities.id, publicActivities.ludoId],
  }),
  site: one(ludoSites, {
    fields: [publicActivitySites.siteId, publicActivitySites.ludoId],
    references: [ludoSites.id, ludoSites.ludoId],
  }),
}))

export const publicActivityDatesRelations = relations(publicActivityDates, ({ one }) => ({
  activity: one(publicActivities, {
    fields: [publicActivityDates.activityId, publicActivityDates.ludoId],
    references: [publicActivities.id, publicActivities.ludoId],
  }),
}))

export const publicActivityExceptionsRelations = relations(publicActivityExceptions, ({ one }) => ({
  activity: one(publicActivities, {
    fields: [publicActivityExceptions.activityId, publicActivityExceptions.ludoId],
    references: [publicActivities.id, publicActivities.ludoId],
  }),
}))

export const publicActivityRegistrationsRelations = relations(
  publicActivityRegistrations,
  ({ one, many }) => ({
    activity: one(publicActivities, {
      fields: [publicActivityRegistrations.activityId, publicActivityRegistrations.ludoId],
      references: [publicActivities.id, publicActivities.ludoId],
    }),
    handledBy: one(members, {
      fields: [publicActivityRegistrations.handledByMemberId, publicActivityRegistrations.ludoId],
      references: [members.id, members.ludoId],
      relationName: 'publicActivityRegistrationHandler',
    }),
    outbox: many(publicActivityRegistrationOutbox),
  }),
)

export const publicActivityRegistrationOutboxRelations = relations(
  publicActivityRegistrationOutbox,
  ({ one }) => ({
    registration: one(publicActivityRegistrations, {
      fields: [
        publicActivityRegistrationOutbox.registrationId,
        publicActivityRegistrationOutbox.ludoId,
      ],
      references: [publicActivityRegistrations.id, publicActivityRegistrations.ludoId],
    }),
  }),
)

export const eventTypesRelations = relations(eventTypes, ({ one, many }) => ({
  ludo: one(ludotheques, {
    fields: [eventTypes.ludoId],
    references: [ludotheques.id],
  }),
  records: many(attendanceRecords),
}))

// ─── Thèmes ──────────────────────────────────────────────────────────────────

export const themes = pgTable('themes', {
  id: uuid('id').defaultRandom().primaryKey(),
  ownerLudoId: uuid('owner_ludo_id')
    .notNull()
    .references(() => ludotheques.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  isShareable: boolean('is_shareable').notNull().default(false),
  isArchived: boolean('is_archived').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// État d'un objet (présent / à réparer / manquant). Partagé par les check-ups,
// le sous-ensemble installé et la liste de référence du thème (état final).
export const checkupItemStatus = pgEnum('checkup_item_status', ['present', 'a_reparer', 'manquant'])

export const themeItems = pgTable('theme_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  themeId: uuid('theme_id')
    .notNull()
    .references(() => themes.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  quantity: integer('quantity').notNull().default(1),
  isArchived: boolean('is_archived').notNull().default(false),
  // État final reporté par le dernier check-up de clôture d'une installation.
  condition: checkupItemStatus('condition').notNull().default('present'),
})

export const themeImages = pgTable('theme_images', {
  id: uuid('id').defaultRandom().primaryKey(),
  themeId: uuid('theme_id')
    .notNull()
    .references(() => themes.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  storageKey: text('storage_key').notNull(),
  isCover: boolean('is_cover').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const loanStatus = pgEnum('loan_status', ['en_attente', 'actif', 'retourne', 'annule'])

export const themeLoans = pgTable('theme_loans', {
  id: uuid('id').defaultRandom().primaryKey(),
  themeId: uuid('theme_id')
    .notNull()
    .references(() => themes.id, { onDelete: 'cascade' }),
  fromLudoId: uuid('from_ludo_id')
    .notNull()
    .references(() => ludotheques.id),
  toLudoId: uuid('to_ludo_id')
    .notNull()
    .references(() => ludotheques.id),
  status: loanStatus('status').notNull().default('actif'),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const themesRelations = relations(themes, ({ one, many }) => ({
  ownerLudo: one(ludotheques, {
    fields: [themes.ownerLudoId],
    references: [ludotheques.id],
  }),
  items: many(themeItems),
  images: many(themeImages),
  loans: many(themeLoans),
  installations: many(themeInstallations),
}))

export const themeItemsRelations = relations(themeItems, ({ one }) => ({
  theme: one(themes, {
    fields: [themeItems.themeId],
    references: [themes.id],
  }),
}))

export const themeImagesRelations = relations(themeImages, ({ one }) => ({
  theme: one(themes, {
    fields: [themeImages.themeId],
    references: [themes.id],
  }),
}))

export const themeLoansRelations = relations(themeLoans, ({ one }) => ({
  theme: one(themes, {
    fields: [themeLoans.themeId],
    references: [themes.id],
  }),
  fromLudo: one(ludotheques, {
    fields: [themeLoans.fromLudoId],
    references: [ludotheques.id],
  }),
  toLudo: one(ludotheques, {
    fields: [themeLoans.toLudoId],
    references: [ludotheques.id],
  }),
}))

// ─── Thèmes : installations & check-ups ──────────────────────────────────────
// Une installation = sous-ensemble d'items d'un thème sorti pour une animation
// (le « mini theme kit »). Un check-up = contrôle daté présent/manquant des items
// installés. La liste de référence `theme_items` (contenu total de la caisse)
// n'est jamais modifiée par ces tables. Voir docs/features/13-themes-checkup.md.

export const installationStatus = pgEnum('installation_status', ['en_cours', 'cloturee'])

export const themeInstallations = pgTable('theme_installations', {
  id: uuid('id').defaultRandom().primaryKey(),
  themeId: uuid('theme_id')
    .notNull()
    .references(() => themes.id, { onDelete: 'cascade' }),
  // Ludo où le thème est physiquement installé (propriétaire ou emprunteuse).
  ludoId: uuid('ludo_id')
    .notNull()
    .references(() => ludotheques.id),
  installedByMemberId: uuid('installed_by_member_id')
    .notNull()
    .references(() => members.id),
  installedAt: timestamp('installed_at').notNull().defaultNow(),
  closedAt: timestamp('closed_at'),
  status: installationStatus('status').notNull().default('en_cours'),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const themeInstallationItems = pgTable('theme_installation_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  installationId: uuid('installation_id')
    .notNull()
    .references(() => themeInstallations.id, { onDelete: 'cascade' }),
  themeItemId: uuid('theme_item_id')
    .notNull()
    .references(() => themeItems.id, { onDelete: 'cascade' }),
  // État courant persistant de l'objet (mis à jour par check-up ou résolution).
  condition: checkupItemStatus('condition').notNull().default('present'),
})

export const themeCheckups = pgTable('theme_checkups', {
  id: uuid('id').defaultRandom().primaryKey(),
  installationId: uuid('installation_id')
    .notNull()
    .references(() => themeInstallations.id, { onDelete: 'cascade' }),
  checkedByMemberId: uuid('checked_by_member_id')
    .notNull()
    .references(() => members.id),
  checkedAt: timestamp('checked_at').notNull().defaultNow(),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const themeCheckupItems = pgTable('theme_checkup_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  checkupId: uuid('checkup_id')
    .notNull()
    .references(() => themeCheckups.id, { onDelete: 'cascade' }),
  installationItemId: uuid('installation_item_id')
    .notNull()
    .references(() => themeInstallationItems.id, { onDelete: 'cascade' }),
  status: checkupItemStatus('status').notNull(),
  note: text('note'),
})

export const themeInstallationsRelations = relations(themeInstallations, ({ one, many }) => ({
  theme: one(themes, {
    fields: [themeInstallations.themeId],
    references: [themes.id],
  }),
  ludo: one(ludotheques, {
    fields: [themeInstallations.ludoId],
    references: [ludotheques.id],
  }),
  installedBy: one(members, {
    fields: [themeInstallations.installedByMemberId],
    references: [members.id],
  }),
  items: many(themeInstallationItems),
  checkups: many(themeCheckups),
}))

export const themeInstallationItemsRelations = relations(themeInstallationItems, ({ one }) => ({
  installation: one(themeInstallations, {
    fields: [themeInstallationItems.installationId],
    references: [themeInstallations.id],
  }),
  themeItem: one(themeItems, {
    fields: [themeInstallationItems.themeItemId],
    references: [themeItems.id],
  }),
}))

export const themeCheckupsRelations = relations(themeCheckups, ({ one, many }) => ({
  installation: one(themeInstallations, {
    fields: [themeCheckups.installationId],
    references: [themeInstallations.id],
  }),
  checkedBy: one(members, {
    fields: [themeCheckups.checkedByMemberId],
    references: [members.id],
  }),
  items: many(themeCheckupItems),
}))

export const themeCheckupItemsRelations = relations(themeCheckupItems, ({ one }) => ({
  checkup: one(themeCheckups, {
    fields: [themeCheckupItems.checkupId],
    references: [themeCheckups.id],
  }),
  installationItem: one(themeInstallationItems, {
    fields: [themeCheckupItems.installationItemId],
    references: [themeInstallationItems.id],
  }),
}))

// ─── Cross-ludo (demandes d'aide) ────────────────────────────────────────────

export const helpRequestStatus = pgEnum('help_request_status', ['ouverte', 'pourvue', 'annulee'])

export const helpRequests = pgTable('help_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  ludoId: uuid('ludo_id')
    .notNull()
    .references(() => ludotheques.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  slotInfo: text('slot_info'),
  notes: text('notes'),
  status: helpRequestStatus('status').notNull().default('ouverte'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const helpResponseStatus = pgEnum('help_response_status', ['propose', 'confirme', 'refuse'])

export const helpResponses = pgTable('help_responses', {
  id: uuid('id').defaultRandom().primaryKey(),
  helpRequestId: uuid('help_request_id')
    .notNull()
    .references(() => helpRequests.id, { onDelete: 'cascade' }),
  memberId: uuid('member_id')
    .notNull()
    .references(() => members.id),
  ludoId: uuid('ludo_id')
    .notNull()
    .references(() => ludotheques.id),
  status: helpResponseStatus('status').notNull().default('propose'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const helpRequestsRelations = relations(helpRequests, ({ one, many }) => ({
  ludo: one(ludotheques, {
    fields: [helpRequests.ludoId],
    references: [ludotheques.id],
  }),
  responses: many(helpResponses),
}))

export const helpResponsesRelations = relations(helpResponses, ({ one }) => ({
  request: one(helpRequests, {
    fields: [helpResponses.helpRequestId],
    references: [helpRequests.id],
  }),
  member: one(members, {
    fields: [helpResponses.memberId],
    references: [members.id],
  }),
  ludo: one(ludotheques, {
    fields: [helpResponses.ludoId],
    references: [ludotheques.id],
  }),
}))

// ─── Interne ludo ────────────────────────────────────────────────────────────

export const gameWishStatus = pgEnum('game_wish_status', ['souhaite', 'achete'])

export const gameWishes = pgTable('game_wishes', {
  id: uuid('id').defaultRandom().primaryKey(),
  ludoId: uuid('ludo_id')
    .notNull()
    .references(() => ludotheques.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  link: text('link'),
  priceChf: integer('price_chf'), // en centimes
  status: gameWishStatus('status').notNull().default('souhaite'),
  addedById: uuid('added_by_id').references(() => members.id),
  buyerId: uuid('buyer_id').references(() => members.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const supplyUrgency = pgEnum('supply_urgency', ['normale', 'haute', 'critique'])

export const supplyStatus = pgEnum('supply_status', ['en_attente', 'commande', 'recu'])

export const supplyRequests = pgTable('supply_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  ludoId: uuid('ludo_id')
    .notNull()
    .references(() => ludotheques.id, { onDelete: 'cascade' }),
  memberId: uuid('member_id')
    .notNull()
    .references(() => members.id),
  name: text('name').notNull(),
  link: text('link'),
  urgency: supplyUrgency('urgency').notNull().default('normale'),
  status: supplyStatus('status').notNull().default('en_attente'),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const gameWishesRelations = relations(gameWishes, ({ one }) => ({
  addedBy: one(members, {
    fields: [gameWishes.addedById],
    references: [members.id],
    relationName: 'gameWishAddedBy',
  }),
  buyer: one(members, {
    fields: [gameWishes.buyerId],
    references: [members.id],
    relationName: 'gameWishBuyer',
  }),
}))

export const supplyRequestsRelations = relations(supplyRequests, ({ one }) => ({
  member: one(members, {
    fields: [supplyRequests.memberId],
    references: [members.id],
  }),
}))

// ─── Audit ───────────────────────────────────────────────────────────────────

export const activityLog = pgTable('activity_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  ludoId: uuid('ludo_id')
    .notNull()
    .references(() => ludotheques.id, { onDelete: 'cascade' }),
  memberId: uuid('member_id').references(() => members.id),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// ─── Notifications in-app ──────────────────────────────────────────────────────

export const notificationType = pgEnum('notification_type', [
  'theme_request',
  'theme_request_confirmed',
  'theme_request_declined',
  'help_response',
  'help_confirmed',
  'absence_request',
  'absence_approved',
  'absence_refused',
  'theme_installed',
  'installation_closed',
  'checkup_recorded',
  'checkup_missing_item',
  'supply_request',
  'campaign_sent',
])

export const notificationSeverity = pgEnum('notification_severity', ['info', 'action_required'])

export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  recipientLudoId: uuid('recipient_ludo_id')
    .notNull()
    .references(() => ludotheques.id, { onDelete: 'cascade' }),
  // null → toute la ludo destinataire ; sinon un membre précis.
  recipientMemberId: uuid('recipient_member_id').references(() => members.id, {
    onDelete: 'cascade',
  }),
  type: notificationType('type').notNull(),
  severity: notificationSeverity('severity').notNull().default('info'),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id'),
  title: text('title').notNull(),
  body: text('body'),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const notificationsRelations = relations(notifications, ({ one }) => ({
  recipientLudo: one(ludotheques, {
    fields: [notifications.recipientLudoId],
    references: [ludotheques.id],
  }),
  recipientMember: one(members, {
    fields: [notifications.recipientMemberId],
    references: [members.id],
  }),
}))

// ─── Newsletter ──────────────────────────────────────────────────────────────

export const newsletterContactStatus = pgEnum('newsletter_contact_status', [
  'subscribed',
  'unsubscribed',
  'bounced',
])

export const newsletterContactSource = pgEnum('newsletter_contact_source', ['manual', 'import'])

// Segment d'un contact (un seul par contact). `null` = non classé (reçoit les envois « Tous »).
export const newsletterContactTag = pgEnum('newsletter_contact_tag', [
  'famille',
  'institution',
  'partenaire',
  'autre',
])

export const newsletterContacts = pgTable(
  'newsletter_contacts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ludoId: uuid('ludo_id')
      .notNull()
      .references(() => ludotheques.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    firstName: text('first_name'),
    lastName: text('last_name'),
    status: newsletterContactStatus('status').notNull().default('subscribed'),
    // Token public pour le désabonnement (page hors auth).
    unsubscribeToken: text('unsubscribe_token').notNull().unique(),
    source: newsletterContactSource('source').notNull().default('manual'),
    // Segment du contact (un seul). `null` = non classé.
    tag: newsletterContactTag('tag'),
    notes: text('notes'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  // Dédup par ludo, insensible à la casse de l'email.
  (t) => [uniqueIndex('newsletter_contacts_ludo_email_idx').on(t.ludoId, sql`lower(${t.email})`)],
)

/** Contenu structuré d'une campagne (champs fixes, pas de WYSIWYG). */
export interface CampaignContent {
  title?: string
  body: string
  imageUrl?: string
  ctaLabel?: string
  ctaUrl?: string
  pdfUrl?: string
  pdfAsAttachment?: boolean
}

export const campaignStatus = pgEnum('campaign_status', ['draft', 'sent'])

export const campaigns = pgTable('campaigns', {
  id: uuid('id').defaultRandom().primaryKey(),
  ludoId: uuid('ludo_id')
    .notNull()
    .references(() => ludotheques.id, { onDelete: 'cascade' }),
  subject: text('subject').notNull(),
  previewText: text('preview_text'),
  content: jsonb('content').$type<CampaignContent>(),
  status: campaignStatus('status').notNull().default('draft'),
  // Segment ciblé par la campagne. `null` = tous les abonnés.
  targetTag: newsletterContactTag('target_tag'),
  recipientCount: integer('recipient_count').notNull().default(0),
  sentAt: timestamp('sent_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const campaignSendStatus = pgEnum('campaign_send_status', ['sent', 'failed', 'bounced'])

export const campaignSends = pgTable('campaign_sends', {
  id: uuid('id').defaultRandom().primaryKey(),
  campaignId: uuid('campaign_id')
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  contactId: uuid('contact_id')
    .notNull()
    .references(() => newsletterContacts.id, { onDelete: 'cascade' }),
  status: campaignSendStatus('status').notNull(),
  resendId: text('resend_id'),
  error: text('error'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const newsletterContactsRelations = relations(newsletterContacts, ({ one }) => ({
  ludo: one(ludotheques, {
    fields: [newsletterContacts.ludoId],
    references: [ludotheques.id],
  }),
}))

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  ludo: one(ludotheques, {
    fields: [campaigns.ludoId],
    references: [ludotheques.id],
  }),
  sends: many(campaignSends),
}))

export const campaignSendsRelations = relations(campaignSends, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [campaignSends.campaignId],
    references: [campaigns.id],
  }),
  contact: one(newsletterContacts, {
    fields: [campaignSends.contactId],
    references: [newsletterContacts.id],
  }),
}))

// ─── Types utilitaires ────────────────────────────────────────────────────────

export type LudothequeRow = typeof ludotheques.$inferSelect
export type LudothequeInsert = typeof ludotheques.$inferInsert
export type PublicSiteSettingsRow = typeof publicSiteSettings.$inferSelect
export type PublicSiteSettingsInsert = typeof publicSiteSettings.$inferInsert
export type PublicContentStatus = (typeof publicContentStatus.enumValues)[number]
export type PublicAnnouncementRow = typeof publicAnnouncements.$inferSelect
export type PublicAnnouncementInsert = typeof publicAnnouncements.$inferInsert
export type PublicAnnouncementSiteRow = typeof publicAnnouncementSites.$inferSelect
export type PublicAnnouncementSiteInsert = typeof publicAnnouncementSites.$inferInsert
export type PublicNewsRow = typeof publicNews.$inferSelect
export type PublicNewsInsert = typeof publicNews.$inferInsert
export type PublicNewsSiteRow = typeof publicNewsSites.$inferSelect
export type PublicNewsSiteInsert = typeof publicNewsSites.$inferInsert
export type PublicTopThreeRow = typeof publicTopThrees.$inferSelect
export type PublicTopThreeInsert = typeof publicTopThrees.$inferInsert
export type PublicTopThreeSiteRow = typeof publicTopThreeSites.$inferSelect
export type PublicTopThreeSiteInsert = typeof publicTopThreeSites.$inferInsert
export type PublicFaqRow = typeof publicFaqs.$inferSelect
export type PublicFaqInsert = typeof publicFaqs.$inferInsert
export type PublicDocumentKind = (typeof publicDocumentKind.enumValues)[number]
export type PublicDocumentRow = typeof publicDocuments.$inferSelect
export type PublicDocumentInsert = typeof publicDocuments.$inferInsert
export type PublicGalleryImageRow = typeof publicGalleryImages.$inferSelect
export type PublicGalleryImageInsert = typeof publicGalleryImages.$inferInsert
export type PublicProfileSection = (typeof publicProfileSection.enumValues)[number]
export type PublicProfileRow = typeof publicProfiles.$inferSelect
export type PublicProfileInsert = typeof publicProfiles.$inferInsert
export type PublicDirectoryEntryRow = typeof publicDirectoryEntries.$inferSelect
export type PublicDirectoryEntryInsert = typeof publicDirectoryEntries.$inferInsert
export type PublicContactStatus = (typeof publicContactStatus.enumValues)[number]
export type PublicContactRecipient = (typeof publicContactRecipient.enumValues)[number]
export type PublicContactMessageRow = typeof publicContactMessages.$inferSelect
export type PublicContactMessageInsert = typeof publicContactMessages.$inferInsert
export type PublicActivityRow = typeof publicActivities.$inferSelect
export type PublicActivityInsert = typeof publicActivities.$inferInsert
export type PublicActivityType = (typeof publicActivityType.enumValues)[number]
export type PublicActivityLifecycle = (typeof publicActivityLifecycle.enumValues)[number]
export type PublicActivitySiteRow = typeof publicActivitySites.$inferSelect
export type PublicActivityDateRow = typeof publicActivityDates.$inferSelect
export type PublicActivityExceptionRow = typeof publicActivityExceptions.$inferSelect
export type PublicActivityRegistrationStatus =
  (typeof publicActivityRegistrationStatus.enumValues)[number]
export type PublicActivityRegistrationRow = typeof publicActivityRegistrations.$inferSelect
export type PublicActivityRegistrationInsert = typeof publicActivityRegistrations.$inferInsert
export type PublicActivityRegistrationOutboxStatus =
  (typeof publicActivityRegistrationOutboxStatus.enumValues)[number]
export type PublicActivityRegistrationOutboxRow =
  typeof publicActivityRegistrationOutbox.$inferSelect
export type PublicActivityRegistrationOutboxInsert =
  typeof publicActivityRegistrationOutbox.$inferInsert
export type FamilyRegistrationSubmissionStatus =
  (typeof familyRegistrationSubmissionStatus.enumValues)[number]
export type FamilyRegistrationPaymentMethod =
  (typeof familyRegistrationPaymentMethod.enumValues)[number]
export type FamilyRegistrationGender = (typeof familyRegistrationGender.enumValues)[number]
export type FamilyRegistrationDocumentKind =
  (typeof familyRegistrationDocumentKind.enumValues)[number]
export type FamilyRegistrationFormRow = typeof familyRegistrationForms.$inferSelect
export type FamilyRegistrationFormVersionRow = typeof familyRegistrationFormVersions.$inferSelect
export type FamilyRegistrationDocumentRow = typeof familyRegistrationDocuments.$inferSelect
export type FamilyRegistrationDocumentVersionRow =
  typeof familyRegistrationDocumentVersions.$inferSelect
export type FamilySubmissionReceiptRow = typeof familySubmissionReceipts.$inferSelect
export type FamilyRegistrationSubmissionRow = typeof familyRegistrationSubmissions.$inferSelect
export type FamilyRegistrationSubmissionMemberRow =
  typeof familyRegistrationSubmissionMembers.$inferSelect
export type FamilyProcessingDailyStatRow = typeof familyProcessingDailyStats.$inferSelect
export type LudoSiteRow = typeof ludoSites.$inferSelect
export type LudoSiteInsert = typeof ludoSites.$inferInsert
export type SiteOpeningIntervalRow = typeof siteOpeningIntervals.$inferSelect
export type SiteOpeningIntervalInsert = typeof siteOpeningIntervals.$inferInsert
export type MemberRow = typeof members.$inferSelect
export type MemberInsert = typeof members.$inferInsert
export type SeasonRow = typeof seasons.$inferSelect
export type SeasonInsert = typeof seasons.$inferInsert
export type SaturdaySlotRow = typeof saturdaySlots.$inferSelect
export type SaturdaySlotInsert = typeof saturdaySlots.$inferInsert
export type AssignmentRow = typeof assignments.$inferSelect
export type AssignmentInsert = typeof assignments.$inferInsert
export type ClosurePeriodRow = typeof closurePeriods.$inferSelect
export type ClosurePeriodInsert = typeof closurePeriods.$inferInsert
export type SeasonMemberSettingRow = typeof seasonMemberSettings.$inferSelect
export type SeasonMemberSettingInsert = typeof seasonMemberSettings.$inferInsert
export type AbsenceRow = typeof absences.$inferSelect
export type AbsenceInsert = typeof absences.$inferInsert
export type AttendanceRow = typeof attendanceRecords.$inferSelect
export type AttendanceInsert = typeof attendanceRecords.$inferInsert
export type AttendancePeriod = (typeof attendancePeriod.enumValues)[number]
export type WeatherCondition = (typeof weatherCondition.enumValues)[number]
export type EventTypeRow = typeof eventTypes.$inferSelect
export type EventTypeInsert = typeof eventTypes.$inferInsert
export type ThemeRow = typeof themes.$inferSelect
export type ThemeInsert = typeof themes.$inferInsert
export type ThemeItemRow = typeof themeItems.$inferSelect
export type ThemeItemInsert = typeof themeItems.$inferInsert
export type ThemeImageRow = typeof themeImages.$inferSelect
export type ThemeImageInsert = typeof themeImages.$inferInsert
export type ThemeLoanRow = typeof themeLoans.$inferSelect
export type ThemeLoanInsert = typeof themeLoans.$inferInsert
export type ThemeInstallationRow = typeof themeInstallations.$inferSelect
export type ThemeInstallationInsert = typeof themeInstallations.$inferInsert
export type ThemeInstallationItemRow = typeof themeInstallationItems.$inferSelect
export type ThemeInstallationItemInsert = typeof themeInstallationItems.$inferInsert
export type ThemeCheckupRow = typeof themeCheckups.$inferSelect
export type ThemeCheckupInsert = typeof themeCheckups.$inferInsert
export type ThemeCheckupItemRow = typeof themeCheckupItems.$inferSelect
export type ThemeCheckupItemInsert = typeof themeCheckupItems.$inferInsert
export type HelpRequestRow = typeof helpRequests.$inferSelect
export type HelpResponseRow = typeof helpResponses.$inferSelect
export type GameWishRow = typeof gameWishes.$inferSelect
export type GameWishInsert = typeof gameWishes.$inferInsert
export type SupplyRequestRow = typeof supplyRequests.$inferSelect
export type SupplyRequestInsert = typeof supplyRequests.$inferInsert
export type ActivityLogRow = typeof activityLog.$inferSelect
export type ActivityLogInsert = typeof activityLog.$inferInsert
export type NotificationRow = typeof notifications.$inferSelect
export type NotificationInsert = typeof notifications.$inferInsert
export type NotificationType = (typeof notificationType.enumValues)[number]
export type NotificationSeverity = (typeof notificationSeverity.enumValues)[number]
export type NewsletterContactRow = typeof newsletterContacts.$inferSelect
export type NewsletterContactInsert = typeof newsletterContacts.$inferInsert
export type NewsletterContactStatus = (typeof newsletterContactStatus.enumValues)[number]
export type NewsletterContactSource = (typeof newsletterContactSource.enumValues)[number]
export type NewsletterContactTag = (typeof newsletterContactTag.enumValues)[number]
export type CampaignRow = typeof campaigns.$inferSelect
export type CampaignInsert = typeof campaigns.$inferInsert
export type CampaignStatus = (typeof campaignStatus.enumValues)[number]
export type CampaignSendRow = typeof campaignSends.$inferSelect
export type CampaignSendInsert = typeof campaignSends.$inferInsert
export type CampaignSendStatus = (typeof campaignSendStatus.enumValues)[number]
