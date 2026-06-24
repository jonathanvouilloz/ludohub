import type { GuideSection } from '$lib/aide/types'
import { section as themes } from './themes'

// Le skill user-docs ajoute ici un import + une entrée par module généré.
export const sections: GuideSection[] = [themes]

// Cache-busting des captures : bumpé à chaque régénération de la doc par le skill.
// Empêche les navigateurs de resservir d'anciennes captures (même URL, nouveau contenu).
export const docsVersion = '2026-06-24-2'
