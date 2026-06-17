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
  // Contact public (source : fiches Ville de Genève — voir docs/data/ludotheques-geneve.json)
  phone: text('phone'),
  email: text('email'),
  website: text('website'),
  responsible: text('responsible'),
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

// ─── Relations (API relationnelle Drizzle : `db.query.*.findMany({ with })`) ──

export const membersRelations = relations(members, ({ many }) => ({
  assignments: many(assignments),
  absences: many(absences),
}))

export const seasonsRelations = relations(seasons, ({ many }) => ({
  slots: many(saturdaySlots),
  closurePeriods: many(closurePeriods),
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

export const checkupItemStatus = pgEnum('checkup_item_status', ['present', 'manquant'])

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

export const gameWishesRelations = relations(gameWishes, ({ one }) => ({
  buyer: one(members, {
    fields: [gameWishes.buyerId],
    references: [members.id],
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
export type ClosurePeriodRow = typeof closurePeriods.$inferSelect
export type ClosurePeriodInsert = typeof closurePeriods.$inferInsert
export type AbsenceRow = typeof absences.$inferSelect
export type AbsenceInsert = typeof absences.$inferInsert
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
