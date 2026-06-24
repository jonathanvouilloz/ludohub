import type { GuideSection } from '$lib/aide/types'
import { section as demarrer } from './demarrer'
import { section as planning } from './planning'
import { section as absences } from './absences'
import { section as themes } from './themes'
import { section as jeux } from './jeux'
import { section as materiel } from './materiel'
import { section as newsletter } from './newsletter'
import { section as reseau } from './reseau'

// Le skill user-docs ajoute ici un import + une entrée par module généré.
// Ordre = sommaire affiché sur /aide (du premier pas vers les modules avancés).
export const sections: GuideSection[] = [
  demarrer,
  planning,
  absences,
  themes,
  jeux,
  materiel,
  newsletter,
  reseau,
]

// Cache-busting des captures : bumpé à chaque régénération de la doc par le skill.
// Empêche les navigateurs de resservir d'anciennes captures (même URL, nouveau contenu).
export const docsVersion = '2026-06-24-6'
