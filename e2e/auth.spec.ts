import { expect, test } from '@playwright/test'

/**
 * Flows critiques AUTH multi-tenant.
 * Pré-requis : la ludo de démo doit être seedée (`pnpm db:seed`).
 *   slug = paquis | password = paquis2026
 *   membres actifs : Alice Dupont (responsable), Bruno Martin, Clara Nguyen
 *   membre inactif : David Ancien (ne doit jamais apparaître)
 */

const SLUG = 'paquis'
const PASSWORD = 'paquis2026'

test('flow complet : password → choix du membre → dashboard', async ({ page }) => {
  await page.goto(`/${SLUG}`)

  // Non connecté → redirigé vers la page de login brandée
  await expect(page).toHaveURL(`/auth/${SLUG}`)
  await expect(page.getByRole('heading', { name: 'Ludothèque des Pâquis' })).toBeVisible()

  // Étape 1 : mot de passe
  await page.getByLabel('Mot de passe de la ludothèque').fill(PASSWORD)
  await page.getByRole('button', { name: 'Continuer' }).click()

  // Étape 2 : la liste des membres actifs apparaît, l'inactif est absent
  await expect(page.getByText('Qui êtes-vous ?')).toBeVisible()
  await expect(page.getByRole('button', { name: /Alice Dupont/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /David Ancien/ })).toHaveCount(0)

  // Choix du membre → dashboard
  await page.getByRole('button', { name: /Bruno Martin/ }).click()
  await expect(page).toHaveURL(`/${SLUG}`)
  await expect(page.getByRole('heading', { name: /Bruno Martin/ })).toBeVisible()
})

test('mauvais mot de passe → message générique, pas de liste membres', async ({ page }) => {
  await page.goto(`/auth/${SLUG}`)

  await page.getByLabel('Mot de passe de la ludothèque').fill('mauvais-mdp')
  await page.getByRole('button', { name: 'Continuer' }).click()

  await expect(page.getByRole('alert')).toContainText('Identifiants incorrects')
  await expect(page.getByText('Qui êtes-vous ?')).toHaveCount(0)
})

test('slug inconnu → 404', async ({ page }) => {
  const res = await page.goto('/slug-inexistant')
  expect(res?.status()).toBe(404)
  await expect(page.getByText('Ludothèque introuvable')).toBeVisible()
})
