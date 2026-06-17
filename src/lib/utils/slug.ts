/**
 * Normalise un texte en slug d'URL : minuscules, sans accents, sans espaces.
 * Ex. « Ludothèque des Pâquis » -> « ludotheque-des-paquis ».
 */
export function normalizeSlug(input: string): string {
  return input
    .normalize('NFD') // décompose les caractères accentués
    .replace(/[̀-ͯ]/g, '') // retire les diacritiques combinants
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-') // tout ce qui n'est pas alphanumérique -> tiret
    .replace(/^-+|-+$/g, '') // retire les tirets en début/fin
}
