import { expect, test, type Page } from '@playwright/test'

/**
 * Flow critique THÈMES : prêt push d'une ludo vers une autre.
 * Pré-requis : `pnpm db:seed` (ludos « paquis » et « servette »).
 */

const SLUG = 'paquis'
const PASSWORD = 'paquis2026'
const TARGET_LUDO = 'Ludothèque de la Servette'

async function login(page: Page, member: string) {
  await page.goto(`/auth/${SLUG}`)
  await page.getByLabel('Mot de passe de la ludothèque').fill(PASSWORD)
  await page.getByRole('button', { name: 'Continuer' }).click()
  await page.getByRole('button', { name: new RegExp(member) }).click()
  await expect(page).toHaveURL(`/${SLUG}`)
}

test('prêt push : créer un thème puis le prêter à une autre ludo', async ({ page }) => {
  await login(page, 'Alice Dupont')

  // Création d'un thème (nom unique pour éviter les collisions entre runs).
  const name = `Carnaval ${Date.now()}`
  await page.goto(`/${SLUG}/themes/new`)
  await page.getByLabel('Nom du thème').fill(name)
  await page.getByRole('button', { name: 'Créer le thème' }).click()

  // Redirigé vers la fiche du thème.
  await expect(page).toHaveURL(new RegExp(`/${SLUG}/themes/[0-9a-f-]+$`))
  await expect(page.getByRole('heading', { name: new RegExp(name) })).toBeVisible()

  // Ouvre le dialog de prêt et choisit la ludo destinataire.
  await page.getByRole('button', { name: 'Prêter', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.locator('#loan-ludo').click()
  await page.getByRole('option', { name: TARGET_LUDO }).click()
  await dialog.getByRole('button', { name: 'Prêter' }).click()

  // La fiche affiche le prêt actif vers la ludo destinataire.
  await expect(page.getByText('En prêt', { exact: false })).toBeVisible()
  await expect(page.getByText(TARGET_LUDO)).toBeVisible()

  // Le bouton « Prêter » disparaît tant que le prêt est actif.
  await expect(page.getByRole('button', { name: 'Prêter', exact: true })).toHaveCount(0)
})
