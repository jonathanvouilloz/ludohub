import { relations, sql } from 'drizzle-orm'
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
    // FK informatif : qui a clôturé la séance. Set null si le membre est supprimé.
    closedByMemberId: uuid('closed_by_member_id').references(() => members.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    // Un seul `matin` / `apres_midi` par jour et par ludo ; les `evenement`
    // restent libres (plusieurs événements possibles le même jour).
    uniqueIndex('attendance_unique_slot')
      .on(t.ludoId, t.date, t.period)
      .where(sql`${t.period} <> 'evenement'`),
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
  closedBy: one(members, {
    fields: [attendanceRecords.closedByMemberId],
    references: [members.id],
  }),
  eventType: one(eventTypes, {
    fields: [attendanceRecords.eventTypeId],
    references: [eventTypes.id],
  }),
}))

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
