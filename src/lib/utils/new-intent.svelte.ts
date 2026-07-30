import { replaceState } from '$app/navigation'
import { page } from '$app/state'

/**
 * Ouvre un dialog à l'arrivée sur une page avec `?new=1` (FAB de la bottom bar,
 * actions rapides de l'accueil), puis retire le paramètre de l'URL.
 *
 * L'intention est consommée **une seule fois par URL**. Sans cette garde, tout
 * rafraîchissement de `page` — typiquement l'`invalidateAll()` déclenché par
 * l'enregistrement du formulaire — ré-évaluait le paramètre et rouvrait le
 * dialog juste après la validation. `replaceState` est protégé : s'il échoue
 * (routeur pas encore initialisé au premier rendu), le paramètre reste dans
 * l'URL mais la garde empêche toute réouverture.
 *
 * Le compteur se réarme dès que l'URL n'a plus le paramètre, pour qu'un second
 * appui sur le FAB rouvre bien le dialog (navigation client, sans remontage).
 *
 * À appeler à l'initialisation du composant.
 *
 * @example
 * consumeNewIntent(() => (dialogOpen = true))
 */
export function consumeNewIntent(open: () => void): void {
  let handledHref: string | null = null

  $effect(() => {
    const url = page.url
    if (url.searchParams.get('new') !== '1') {
      handledHref = null
      return
    }
    if (handledHref === url.href) return
    handledHref = url.href

    open()

    const next = new URL(url.href)
    next.searchParams.delete('new')
    try {
      replaceState(next, {})
    } catch {
      /* routeur pas encore initialisé : la garde `handledHref` suffit. */
    }
  })
}
