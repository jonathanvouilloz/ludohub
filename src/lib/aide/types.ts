// Types partagés du guide d'aide (skill user-docs).

export interface GuideStep {
  /** id du shot capturé (static/aide/captures/<section>/<shot>.png) */
  shot?: string
  title: string
  /** chaque entrée = une étape */
  body: string[]
  /** encadré "Bon à savoir" optionnel */
  note?: string
}

export interface GuideSection {
  id: string
  title: string
  intro?: string
  steps: GuideStep[]
}
