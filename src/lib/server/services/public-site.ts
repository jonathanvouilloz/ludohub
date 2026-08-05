import { getPublicSiteSettingsRow, setPublicSiteEnabledRow } from '../db/public-site.js'
import { listActiveSiteRows } from '../db/sites.js'
import type { LudoSiteRow, PublicSiteSettingsRow } from '../schema.js'

export class PublicSiteServiceError extends Error {}

export type PublicSiteState =
  | PublicSiteSettingsRow
  | {
      id: null
      ludoId: string
      enabled: false
      createdAt: null
      updatedAt: null
    }

/** Une absence de ligne est volontairement interprétée comme un module désactivé. */
export async function getPublicSiteState(ludoId: string): Promise<PublicSiteState> {
  return (
    (await getPublicSiteSettingsRow(ludoId)) ?? {
      id: null,
      ludoId,
      enabled: false,
      createdAt: null,
      updatedAt: null,
    }
  )
}

export async function isPublicSiteEnabled(ludoId: string): Promise<boolean> {
  return (await getPublicSiteState(ludoId)).enabled
}

/**
 * Active ou désactive uniquement le tenant demandé. L'activation exige au moins
 * un lieu actif et exactement un lieu principal actif.
 */
export async function setPublicSiteEnabled(
  ludoId: string,
  enabled: boolean,
  now = new Date(),
): Promise<PublicSiteSettingsRow> {
  if (enabled) {
    const sites = (await listActiveSiteRows(ludoId)).filter((site) => site.ludoId === ludoId)
    if (sites.length === 0) {
      throw new PublicSiteServiceError('Le site public ne peut pas être activé sans lieu actif.')
    }
    const primaryCount = sites.filter((site) => site.isPrimary).length
    if (primaryCount !== 1) {
      throw new PublicSiteServiceError('Le site public exige exactement un lieu principal actif.')
    }
  }
  return setPublicSiteEnabledRow(ludoId, enabled, now)
}

/**
 * Valide des cibles explicites. Un tableau vide signifie « tous les lieux » et
 * reste vide ; les futurs domaines choisissent eux-mêmes leur représentation.
 */
export async function validatePublicSiteTargets(
  ludoId: string,
  siteIds: string[],
): Promise<LudoSiteRow[]> {
  if (siteIds.length === 0) return []
  if (new Set(siteIds).size !== siteIds.length) {
    throw new PublicSiteServiceError('La liste des lieux contient un doublon.')
  }
  const activeSites = await listActiveSiteRows(ludoId)
  const byId = new Map(
    activeSites.filter((site) => site.ludoId === ludoId).map((site) => [site.id, site]),
  )
  const targets = siteIds.map((siteId) => byId.get(siteId))
  if (targets.some((site) => !site)) {
    throw new PublicSiteServiceError(
      "Un lieu cible est inactif ou n'appartient pas à cette ludothèque.",
    )
  }
  return targets as LudoSiteRow[]
}
