// Types partagés du guide d'aide (skill user-docs).

export interface GuideStep {
  /** id du shot capturé (static/aide/captures/<section>/<shot>.png) */
  shot?: string
  title: string
  /** chaque entrée = une étape (liste numérotée). Supporte le gras `**mot**`. */
  body: string[]
  /** points complémentaires affichés en liste à puces. Supporte le gras. */
  tips?: string[]
  /** encadré "Bon à savoir" optionnel. Supporte le gras. */
  note?: string
}

export interface GuideSection {
  id: string
  title: string
  intro?: string
  steps: GuideStep[]
}
