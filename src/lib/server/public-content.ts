import type { PublicContentStatus } from './schema.js'

export class PublicContentTransitionError extends Error {}

export type PublicContentPublicationState = {
  status: PublicContentStatus
  publishedAt: Date | null
  updatedAt: Date
}

const ALLOWED_TRANSITIONS: Record<PublicContentStatus, readonly PublicContentStatus[]> = {
  draft: ['draft', 'published'],
  published: ['published', 'hidden'],
  hidden: ['hidden', 'published'],
}

/**
 * Applique le cycle éditorial commun sans modifier les champs propres au domaine.
 * Une republication conserve la date de première publication.
 */
export function transitionPublicContent(
  current: Pick<PublicContentPublicationState, 'status' | 'publishedAt'>,
  nextStatus: PublicContentStatus,
  now = new Date(),
): PublicContentPublicationState {
  if (!ALLOWED_TRANSITIONS[current.status].includes(nextStatus)) {
    throw new PublicContentTransitionError(
      `Transition publique interdite : ${current.status} → ${nextStatus}.`,
    )
  }
  return {
    status: nextStatus,
    publishedAt: nextStatus === 'published' ? (current.publishedAt ?? now) : current.publishedAt,
    updatedAt: now,
  }
}

export function createDraftPublicationState(now = new Date()): PublicContentPublicationState {
  return { status: 'draft', publishedAt: null, updatedAt: now }
}
