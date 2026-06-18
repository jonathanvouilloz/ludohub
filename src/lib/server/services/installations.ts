import {
  applyConditions,
  applyThemeItemConditions,
  closeInstallation,
  createCheckup,
  createInstallation,
  getActiveInstallation,
  getInstallationById,
  getInstallationDetail,
  listInstallations,
  setInstallationItemCondition,
} from '../db/installations.js'
import { getActiveLoanToLudo } from '../db/loans.js'
import { deleteThemeItem, getThemeById } from '../db/themes.js'
import type { ThemeCheckupRow, ThemeInstallationRow } from '../schema.js'
import { emitEvent } from './events.js'

/**
 * Erreur métier : message FR destiné à l'utilisateur. Levée par le service,
 * interceptée par les actions SvelteKit pour renvoyer un `fail(400, { error })`.
 */
export class InstallationServiceError extends Error {}

type CheckupItemStatus = 'present' | 'a_reparer' | 'manquant'

type CheckupStatusInput = {
  installationItemId: string
  status: CheckupItemStatus
  note?: string
}

export type ItemResolution = 'repaired' | 'found' | 'lost'

/**
 * Installe un sous-ensemble d'items d'un thème dans la ludo (« mini theme kit »).
 * Autorisé pour la ludo propriétaire OU la ludo emprunteuse d'un prêt actif.
 * Refuse si le thème est archivé, si une installation est déjà en cours, ou si
 * le sous-ensemble est vide / contient des items hors thème ou archivés.
 */
export async function installTheme(
  themeId: string,
  ludoId: string,
  memberId: string,
  itemIds: string[],
  note?: string,
): Promise<ThemeInstallationRow> {
  const theme = await getThemeById(themeId)
  if (!theme) throw new InstallationServiceError('Thème introuvable.')
  if (theme.isArchived) {
    throw new InstallationServiceError('Un thème archivé ne peut pas être installé.')
  }

  const isOwner = theme.ownerLudoId === ludoId
  const borrowed = isOwner ? null : await getActiveLoanToLudo(themeId, ludoId)
  if (!isOwner && !borrowed) {
    throw new InstallationServiceError("Vous n'êtes pas autorisé à installer ce thème.")
  }

  const active = await getActiveInstallation(themeId)
  if (active) {
    throw new InstallationServiceError('Une installation est déjà en cours pour ce thème.')
  }

  // Seuls les items non archivés de ce thème peuvent être sortis.
  const validIds = new Set((theme.items ?? []).filter((i) => !i.isArchived).map((i) => i.id))
  const selected = [...new Set(itemIds)].filter((id) => validIds.has(id))
  if (selected.length === 0) {
    throw new InstallationServiceError('Sélectionnez au moins un item à installer.')
  }

  const installation = await createInstallation(
    {
      themeId,
      ludoId,
      installedByMemberId: memberId,
      notes: note?.trim() || null,
    },
    selected,
  )

  await emitEvent({
    type: 'theme_installed',
    actorLudoId: ludoId,
    actorMemberId: memberId,
    entityType: 'installation',
    entityId: installation.id,
    title: `Thème installé : ${theme.name}`,
    body: `${selected.length} item(s) sortis pour l'animation.`,
    metadata: { themeId, itemCount: selected.length },
  })

  return installation
}

/** Clôture l'installation en cours (le thème retourne dans la caisse). */
export async function closeInstallationForLudo(
  installationId: string,
  ludoId: string,
): Promise<void> {
  const installation = await getInstallationById(installationId)
  if (!installation || installation.ludoId !== ludoId) {
    throw new InstallationServiceError('Installation introuvable.')
  }
  if (installation.status !== 'en_cours') {
    throw new InstallationServiceError('Cette installation est déjà clôturée.')
  }
  await closeInstallation(installationId)

  await emitEvent({
    type: 'installation_closed',
    actorLudoId: ludoId,
    entityType: 'installation',
    entityId: installationId,
    title: 'Installation clôturée',
    body: 'Le thème a été remis dans la caisse.',
    metadata: { themeId: installation.themeId },
  })
}

/** Résumé FR du nombre d'objets à réparer / manquants (pour les notifs). */
function problemSummary(toRepair: number, missing: number): string {
  const parts: string[] = []
  if (toRepair > 0) parts.push(`${toRepair} à réparer`)
  if (missing > 0) parts.push(`${missing} manquant${missing > 1 ? 's' : ''}`)
  return parts.join(' · ')
}

/**
 * Enregistre un check-up présent/à réparer/manquant sur l'installation en cours,
 * met à jour l'état courant de chaque objet, et notifie les responsables s'il
 * reste des problèmes.
 */
export async function recordCheckup(
  installationId: string,
  ludoId: string,
  memberId: string,
  statuses: CheckupStatusInput[],
  note?: string,
): Promise<ThemeCheckupRow> {
  const installation = await getInstallationDetail(installationId)
  if (!installation || installation.ludoId !== ludoId) {
    throw new InstallationServiceError('Installation introuvable.')
  }
  if (installation.status !== 'en_cours') {
    throw new InstallationServiceError('Cette installation est clôturée.')
  }

  const itemIds = new Set(installation.items.map((i) => i.id))
  const clean = statuses.filter((s) => itemIds.has(s.installationItemId))
  if (clean.length === 0) {
    throw new InstallationServiceError('Aucun item à contrôler.')
  }

  const checkup = await createCheckup(installationId, memberId, clean, note?.trim() || null)

  // L'état courant de chaque objet reflète la dernière observation.
  await applyConditions(
    clean.map((s) => ({ installationItemId: s.installationItemId, condition: s.status })),
  )

  const toRepair = clean.filter((s) => s.status === 'a_reparer').length
  const missing = clean.filter((s) => s.status === 'manquant').length
  const problems = toRepair + missing

  await emitEvent({
    type: 'checkup_recorded',
    actorLudoId: ludoId,
    actorMemberId: memberId,
    entityType: 'installation',
    entityId: installationId,
    title: `Check-up : ${installation.theme.name}`,
    body: problems > 0 ? problemSummary(toRepair, missing) + '.' : 'Tous les objets présents.',
    metadata: { checkupId: checkup.id, themeId: installation.themeId, toRepair, missing },
  })

  if (problems > 0) {
    await emitEvent({
      type: 'checkup_missing_item',
      actorLudoId: ludoId,
      actorMemberId: memberId,
      entityType: 'installation',
      entityId: installationId,
      title: `Objets à traiter : ${installation.theme.name}`,
      body: `${problemSummary(toRepair, missing)} lors d'un check-up.`,
      recipientResponsablesOf: ludoId,
      metadata: { checkupId: checkup.id, themeId: installation.themeId, toRepair, missing },
    })
  }

  return checkup
}

/**
 * Check-up FINAL de clôture : enregistre l'état présent/à réparer/manquant de chaque
 * objet installé, **reporte cet état final sur la liste de référence du thème** (la
 * caisse complète), puis clôture l'installation. Notifie les responsables s'il reste
 * des problèmes, comme un check-up normal.
 */
export async function closeInstallationWithCheckup(
  installationId: string,
  ludoId: string,
  memberId: string,
  statuses: CheckupStatusInput[],
  note?: string,
): Promise<ThemeCheckupRow> {
  const installation = await getInstallationDetail(installationId)
  if (!installation || installation.ludoId !== ludoId) {
    throw new InstallationServiceError('Installation introuvable.')
  }
  if (installation.status !== 'en_cours') {
    throw new InstallationServiceError('Cette installation est déjà clôturée.')
  }

  const items = installation.items
  const itemIds = new Set(items.map((i) => i.id))
  const clean = statuses.filter((s) => itemIds.has(s.installationItemId))
  if (clean.length === 0) {
    throw new InstallationServiceError('Aucun item à contrôler.')
  }

  const checkup = await createCheckup(installationId, memberId, clean, note?.trim() || null)

  // État courant du sous-ensemble installé.
  await applyConditions(
    clean.map((s) => ({ installationItemId: s.installationItemId, condition: s.status })),
  )

  // État final reporté sur la caisse : chaque objet installé met à jour son theme_item.
  const itemById = new Map(items.map((i) => [i.id, i]))
  await applyThemeItemConditions(
    clean.map((s) => ({
      themeItemId: itemById.get(s.installationItemId)!.themeItemId,
      condition: s.status,
    })),
  )

  await closeInstallation(installationId)

  const toRepair = clean.filter((s) => s.status === 'a_reparer').length
  const missing = clean.filter((s) => s.status === 'manquant').length
  const problems = toRepair + missing

  await emitEvent({
    type: 'checkup_recorded',
    actorLudoId: ludoId,
    actorMemberId: memberId,
    entityType: 'installation',
    entityId: installationId,
    title: `Check-up final : ${installation.theme.name}`,
    body: problems > 0 ? problemSummary(toRepair, missing) + '.' : 'Tous les objets présents.',
    metadata: { checkupId: checkup.id, themeId: installation.themeId, toRepair, missing },
  })

  if (problems > 0) {
    await emitEvent({
      type: 'checkup_missing_item',
      actorLudoId: ludoId,
      actorMemberId: memberId,
      entityType: 'installation',
      entityId: installationId,
      title: `Objets à traiter : ${installation.theme.name}`,
      body: `${problemSummary(toRepair, missing)} à la clôture.`,
      recipientResponsablesOf: ludoId,
      metadata: { checkupId: checkup.id, themeId: installation.themeId, toRepair, missing },
    })
  }

  await emitEvent({
    type: 'installation_closed',
    actorLudoId: ludoId,
    actorMemberId: memberId,
    entityType: 'installation',
    entityId: installationId,
    title: 'Installation clôturée',
    body: 'Le thème a été remis dans la caisse après check-up final.',
    metadata: { themeId: installation.themeId },
  })

  return checkup
}

/**
 * Résout l'état d'un objet installé (hors check-up, à tout moment) :
 * - `repaired`/`found` → l'objet revient à l'état présent ;
 * - `lost` → l'objet est définitivement retiré du thème entier (l'objet maître
 *   est supprimé ; le cascade le retire du kit installé et de l'historique).
 */
export async function resolveInstallationItemForLudo(
  installationId: string,
  installationItemId: string,
  ludoId: string,
  resolution: ItemResolution,
): Promise<void> {
  const installation = await getInstallationDetail(installationId)
  if (!installation || installation.ludoId !== ludoId) {
    throw new InstallationServiceError('Installation introuvable.')
  }
  if (installation.status !== 'en_cours') {
    throw new InstallationServiceError('Cette installation est clôturée.')
  }
  const item = installation.items.find((i) => i.id === installationItemId)
  if (!item) throw new InstallationServiceError('Objet introuvable.')

  if (resolution === 'lost') {
    // Perdu à jamais : on supprime l'objet du thème (cascade → kit + historique).
    await deleteThemeItem(item.themeItemId)
    return
  }
  await setInstallationItemCondition(installationItemId, 'present')
}

// ─── Lectures ────────────────────────────────────────────────────────────────

/** Installation en cours d'un thème (avec son sous-ensemble), ou undefined. */
export async function getActiveInstallationForTheme(themeId: string) {
  return getActiveInstallation(themeId)
}

/** Détail d'une installation, en vérifiant qu'elle appartient bien à la ludo. */
export async function getInstallationForLudo(installationId: string, ludoId: string) {
  const installation = await getInstallationDetail(installationId)
  if (!installation || installation.ludoId !== ludoId) {
    throw new InstallationServiceError('Installation introuvable.')
  }
  return installation
}

export async function listInstallationsForTheme(themeId: string) {
  return listInstallations(themeId)
}
