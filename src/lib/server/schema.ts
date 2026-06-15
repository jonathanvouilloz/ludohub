import { relations } from 'drizzle-orm'
import {
  boolean,
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
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
  address: text('address'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const memberRole = pgEnum('member_role', ['member', 'responsable'])

export const members = pgTable('members', {
  id: uuid('id').defaultRandom().primaryKey(),
  ludoId: uuid('ludo_id')
    .notNull()
    .references(() => ludotheques.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  role: memberRole('role').notNull().default('member'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// ─── Planning ────────────────────────────────────────────────────────────────

export const seasons = pgTable('seasons', {
  id: uuid('id').defaultRandom().primaryKey(),
  ludoId: uuid('ludo_id')
    .notNull()
    .references(() => ludotheques.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
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
  requiredCount: integer('required_count').notNull().default(2),
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

// ─── Relations (API relationnelle Drizzle : `db.query.*.findMany({ with })`) ──

export const membersRelations = relations(members, ({ many }) => ({
  assignments: many(assignments),
}))

export const seasonsRelations = relations(seasons, ({ many }) => ({
  slots: many(saturdaySlots),
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

export const themeItems = pgTable('theme_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  themeId: uuid('theme_id')
    .notNull()
    .references(() => themes.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  quantity: integer('quantity').notNull().default(1),
  isArchived: boolean('is_archived').notNull().default(false),
})

export const themeImages = pgTable('theme_images', {
  id: uuid('id').defaultRandom().primaryKey(),
  themeId: uuid('theme_id')
    .notNull()
    .references(() => themes.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  storageKey: text('storage_key').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const loanStatus = pgEnum('loan_status', ['actif', 'retourne', 'annule'])

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
  buyerId: uuid('buyer_id').references(() => members.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const supplyCategory = pgEnum('supply_category', [
  'jeux',
  'materiel',
  'fournitures',
  'autre',
])

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
  category: supplyCategory('category').notNull(),
  urgency: supplyUrgency('urgency').notNull().default('normale'),
  status: supplyStatus('status').notNull().default('en_attente'),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

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

// ─── Types utilitaires ────────────────────────────────────────────────────────

export type LudothequeRow = typeof ludotheques.$inferSelect
export type LudothequeInsert = typeof ludotheques.$inferInsert
export type MemberRow = typeof members.$inferSelect
export type MemberInsert = typeof members.$inferInsert
export type SeasonRow = typeof seasons.$inferSelect
export type SeasonInsert = typeof seasons.$inferInsert
export type SaturdaySlotRow = typeof saturdaySlots.$inferSelect
export type SaturdaySlotInsert = typeof saturdaySlots.$inferInsert
export type AssignmentRow = typeof assignments.$inferSelect
export type AssignmentInsert = typeof assignments.$inferInsert
export type AbsenceRow = typeof absences.$inferSelect
export type AbsenceInsert = typeof absences.$inferInsert
export type ThemeRow = typeof themes.$inferSelect
export type ThemeInsert = typeof themes.$inferInsert
export type ThemeLoanRow = typeof themeLoans.$inferSelect
export type HelpRequestRow = typeof helpRequests.$inferSelect
export type HelpResponseRow = typeof helpResponses.$inferSelect
export type GameWishRow = typeof gameWishes.$inferSelect
export type SupplyRequestRow = typeof supplyRequests.$inferSelect
export type ActivityLogRow = typeof activityLog.$inferSelect
