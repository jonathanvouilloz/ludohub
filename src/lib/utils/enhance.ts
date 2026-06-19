import type { SubmitFunction } from '@sveltejs/kit'
import { toast } from '$lib/components/ui/sonner/index.js'

export interface ToastEnhanceOptions {
  /** Message `toast.success` sur `result.type === 'success'`. Défaut « Enregistré. ».
   *  `null` → aucun toast (toggles silencieux fréquents). */
  success?: string | null
  /** Message `toast.success` sur `result.type === 'redirect'` (state client perdu).
   *  Défaut `undefined` → aucun toast (le serveur a décidé de naviguer). */
  redirect?: string | null
  /** `'toast'` (défaut) → `toast.error`. `'inline'` → délègue à `onError` (pas de toast). */
  errorMode?: 'toast' | 'inline'
  /** Message d'erreur fallback si `result.data?.error` est absent. */
  errorFallback?: string
  /** Pilote un état pending : appelé `true` au submit, `false` à la résolution. */
  onPending?: (pending: boolean) => void
  /** Appelé sur succès, après le toast. Usage : `() => (open = false)`. */
  onSuccess?: (data?: Record<string, unknown>) => void
  /** Appelé sur échec avec le message résolu. Usage inline : `(m) => (error = m)`. */
  onError?: (message: string, data?: Record<string, unknown>) => void
  /** Surcharge l'objet passé à `update()`. Défaut : succès `{}`, échec `{ reset: false }`. */
  updateOptions?: { reset?: boolean; invalidateAll?: boolean }
  /** Désactive l'auto-`update()` (cas avancé où l'appelant gère lui-même). */
  skipUpdate?: boolean
}

/**
 * Wrappe `use:enhance` pour uniformiser le feedback : toast succès/erreur,
 * pilotage du pending, fermeture de dialog, en conservant le `await update()`
 * par défaut de SvelteKit.
 *
 * @example
 * <form use:enhance={toastEnhance({ success: 'Membre ajouté.' })}>
 */
export function toastEnhance(opts: ToastEnhanceOptions = {}): SubmitFunction {
  const {
    success = 'Enregistré.',
    redirect,
    errorMode = 'toast',
    errorFallback = 'Une erreur est survenue.',
    onPending,
    onSuccess,
    onError,
    updateOptions,
    skipUpdate = false,
  } = opts

  return () => {
    onPending?.(true)

    return async ({ result, update }) => {
      onPending?.(false)

      if (result.type === 'success') {
        if (success) toast.success(success)
        onSuccess?.(result.data)
        if (!skipUpdate) await update(updateOptions ?? {})
        return
      }

      if (result.type === 'failure') {
        const message = String(result.data?.error ?? errorFallback)
        if (errorMode === 'toast') toast.error(message)
        onError?.(message, result.data)
        if (!skipUpdate) await update(updateOptions ?? { reset: false })
        return
      }

      if (result.type === 'redirect') {
        if (redirect) toast.success(redirect)
        await update()
        return
      }

      // result.type === 'error' (exception non catchée) → comportement par défaut.
      await update()
    }
  }
}
