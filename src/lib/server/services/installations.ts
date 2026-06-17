import {
  closeInstallation,
  createCheckup,
  createInstallation,
  getActiveInstallation,
  getInstallationById,
  getInstallationDetail,
  listInstallations,
} from '../db/installations.js'
import { getActiveLoanToLudo } from '../db/loans.js'
import { getThemeById } from '../db/themes.js'
import type { ThemeCheckupRow, ThemeInstallationRow } from '../schema.js'
import { emitEvent } from './events.js'

/**
 * Erreur métier : message FR destiné à l'utilisateur. Levée par le service,
 * interceptée par les actions SvelteKit pour renvoyer un `fail(400, { error })`.
 */
export class InstallationServiceError extends Error {}

type CheckupStatusInput = {
  installationItemId: string
  status: 'present' | 'manquant'
  note?: string
}

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

/**
 * Enregistre un check-up présent/manquant sur l'installation en cours.
 * Si ≥1 item est marqué `manquant`, notifie les responsables de la ludo.
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

  const missing = clean.filter((s) => s.status === 'manquant')

  await emitEvent({
    type: 'checkup_recorded',
    actorLudoId: ludoId,
    actorMemberId: memberId,
    entityType: 'installation',
    entityId: installationId,
    title: `Check-up : ${installation.theme.name}`,
    body:
      missing.length > 0 ? `${missing.length} item(s) manquant(s).` : 'Tous les items présents.',
    metadata: { checkupId: checkup.id, themeId: installation.themeId, missing: missing.length },
  })

  if (missing.length > 0) {
    await emitEvent({
      type: 'checkup_missing_item',
      actorLudoId: ludoId,
      actorMemberId: memberId,
      entityType: 'installation',
      entityId: installationId,
      title: `Items manquants : ${installation.theme.name}`,
      body: `${missing.length} item(s) signalé(s) manquant(s) lors d'un check-up.`,
      recipientResponsablesOf: ludoId,
      metadata: { checkupId: checkup.id, themeId: installation.themeId, missing: missing.length },
    })
  }

  return checkup
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
