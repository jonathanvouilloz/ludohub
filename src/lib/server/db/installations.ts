import { and, eq } from 'drizzle-orm'
import { db } from './index.js'
import {
  themeCheckupItems,
  themeCheckups,
  themeInstallationItems,
  themeInstallations,
  themeItems,
  type ThemeInstallationInsert,
} from '../schema.js'

// ─── Installations ───────────────────────────────────────────────────────────

/** Installation en cours d'un thème (au plus une à la fois). */
export async function getActiveInstallation(themeId: string) {
  return db.query.themeInstallations.findFirst({
    where: and(eq(themeInstallations.themeId, themeId), eq(themeInstallations.status, 'en_cours')),
    with: { items: { with: { themeItem: true } } },
  })
}

export async function getInstallationById(id: string) {
  return db.query.themeInstallations.findFirst({ where: eq(themeInstallations.id, id) })
}

/** Détail complet : sous-ensemble installé + historique des check-ups. */
export async function getInstallationDetail(id: string) {
  return db.query.themeInstallations.findFirst({
    where: eq(themeInstallations.id, id),
    with: {
      theme: true,
      installedBy: true,
      items: { with: { themeItem: true } },
      checkups: {
        with: {
          checkedBy: true,
          items: { with: { installationItem: { with: { themeItem: true } } } },
        },
        orderBy: (c, { desc }) => desc(c.checkedAt),
      },
    },
  })
}

export async function listInstallations(themeId: string) {
  return db.query.themeInstallations.findMany({
    where: eq(themeInstallations.themeId, themeId),
    with: { items: true, checkups: { columns: { id: true } } },
    orderBy: (i, { desc }) => desc(i.installedAt),
  })
}

/** Crée une installation et son sous-ensemble d'items en une fois. */
export async function createInstallation(data: ThemeInstallationInsert, themeItemIds: string[]) {
  const [installation] = await db.insert(themeInstallations).values(data).returning()
  if (themeItemIds.length > 0) {
    await db
      .insert(themeInstallationItems)
      .values(themeItemIds.map((themeItemId) => ({ installationId: installation.id, themeItemId })))
  }
  return installation
}

export async function closeInstallation(id: string) {
  const [installation] = await db
    .update(themeInstallations)
    .set({ status: 'cloturee', closedAt: new Date() })
    .where(and(eq(themeInstallations.id, id), eq(themeInstallations.status, 'en_cours')))
    .returning()
  return installation
}

// ─── Check-ups ───────────────────────────────────────────────────────────────

/** Enregistre un check-up daté + l'état présent/à réparer/manquant de chaque item installé. */
export async function createCheckup(
  installationId: string,
  checkedByMemberId: string,
  statuses: Array<{
    installationItemId: string
    status: 'present' | 'a_reparer' | 'manquant'
    note?: string
  }>,
  note: string | null,
) {
  const [checkup] = await db
    .insert(themeCheckups)
    .values({ installationId, checkedByMemberId, notes: note })
    .returning()
  if (statuses.length > 0) {
    await db.insert(themeCheckupItems).values(
      statuses.map((s) => ({
        checkupId: checkup.id,
        installationItemId: s.installationItemId,
        status: s.status,
        note: s.note?.trim() || null,
      })),
    )
  }
  return checkup
}

/** Applique l'état courant (condition) à chaque objet installé (depuis un check-up). */
export async function applyConditions(
  updates: Array<{ installationItemId: string; condition: 'present' | 'a_reparer' | 'manquant' }>,
) {
  for (const u of updates) {
    await db
      .update(themeInstallationItems)
      .set({ condition: u.condition })
      .where(eq(themeInstallationItems.id, u.installationItemId))
  }
}

/** Reporte l'état final sur la liste de référence du thème (la caisse complète). */
export async function applyThemeItemConditions(
  updates: Array<{ themeItemId: string; condition: 'present' | 'a_reparer' | 'manquant' }>,
) {
  for (const u of updates) {
    await db
      .update(themeItems)
      .set({ condition: u.condition })
      .where(eq(themeItems.id, u.themeItemId))
  }
}

/** Fixe l'état courant d'un objet installé (réparé/retrouvé → présent, etc.). */
export async function setInstallationItemCondition(
  itemId: string,
  condition: 'present' | 'a_reparer' | 'manquant',
) {
  await db
    .update(themeInstallationItems)
    .set({ condition })
    .where(eq(themeInstallationItems.id, itemId))
}
