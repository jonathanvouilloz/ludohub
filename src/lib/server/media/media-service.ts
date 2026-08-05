import type { StoredBlob } from './blob-storage.js'
import type { AuthorizedMediaScope } from './paths.js'

export type CompensationFailure = {
  scope: AuthorizedMediaScope
  blob: StoredBlob
  registrationError: unknown
  cleanupError: unknown
}

export class MediaCompensationError extends Error {
  constructor(public readonly failure: CompensationFailure) {
    super('L’enregistrement du média a échoué et le fichier temporaire n’a pas pu être supprimé.')
  }
}

export async function uploadAndRegisterMedia<T>(input: {
  authorize: () => Promise<AuthorizedMediaScope>
  upload: (scope: AuthorizedMediaScope) => Promise<StoredBlob>
  register: (scope: AuthorizedMediaScope, blob: StoredBlob) => Promise<T>
  cleanup: (scope: AuthorizedMediaScope, pathname: StoredBlob['pathname']) => Promise<void>
  /** Point d'intégration futur pour journaliser/enfiler un nettoyage durable. */
  onCompensationFailure?: (failure: CompensationFailure) => Promise<void> | void
}): Promise<T> {
  const scope = await input.authorize()
  const blob = await input.upload(scope)
  try {
    return await input.register(scope, blob)
  } catch (registrationError) {
    try {
      await input.cleanup(scope, blob.pathname)
    } catch (cleanupError) {
      const failure = { scope, blob, registrationError, cleanupError }
      try {
        await input.onCompensationFailure?.(failure)
      } catch {
        // Le hook prépare une future outbox mais ne doit jamais masquer l'échec
        // explicite de compensation porté par MediaCompensationError.
      }
      throw new MediaCompensationError(failure)
    }
    throw registrationError
  }
}
