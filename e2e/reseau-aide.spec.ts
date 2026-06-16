import { expect, test, type Page } from '@playwright/test'

/**
 * Flow critique RÉSEAU : demande d'aide cross-ludo.
 * Pré-requis : `pnpm db:seed` (ludos « paquis » et « servette »).
 * Paquis publie une demande → Servette répond → Paquis confirme → « Pourvue ».
 */

async function login(page: Page, slug: string, password: string, member: string) {
  await page.goto(`/auth/${slug}`)
  await page.getByLabel('Mot de passe de la ludothèque').fill(password)
  await page.getByRole('button', { name: 'Continuer' }).click()
  await page.getByRole('button', { name: new RegExp(member) }).click()
  await expect(page).toHaveURL(`/${slug}`)
}

test('demande d’aide : publier, répondre depuis une autre ludo, confirmer', async ({ browser }) => {
  const slot = `Créneau test ${Date.now()}`

  // ── Paquis publie une demande ───────────────────────────────────────────────
  const ctxA = await browser.newContext()
  const pageA = await ctxA.newPage()
  await login(pageA, 'paquis', 'paquis2026', 'Alice Dupont')

  await pageA.goto('/reseau/aide')
  await pageA.getByRole('button', { name: 'Nouvelle demande' }).click()
  const dialog = pageA.getByRole('dialog')
  await dialog.locator('#help-date').click()
  await pageA.locator('[data-today]').click()
  await dialog.getByLabel('Créneau (facultatif)').fill(slot)
  await dialog.getByRole('button', { name: 'Publier la demande' }).click()

  // La demande apparaît dans le feed, côté demandeuse (bouton d'annulation visible).
  const cardA = pageA.locator('article', { hasText: slot })
  await expect(cardA).toBeVisible()
  await expect(cardA.getByRole('button', { name: 'Annuler la demande' })).toBeVisible()

  // ── Servette se porte volontaire ────────────────────────────────────────────
  const ctxB = await browser.newContext()
  const pageB = await ctxB.newPage()
  await login(pageB, 'servette', 'servette2026', 'Emma Rey')

  await pageB.goto('/reseau/aide')
  const cardB = pageB.locator('article', { hasText: slot })
  await expect(cardB).toBeVisible()
  await cardB.getByRole('button', { name: 'Je suis disponible' }).click()
  await expect(cardB.getByText('Vous êtes volontaire')).toBeVisible()

  // ── Paquis confirme le volontaire ───────────────────────────────────────────
  await pageA.reload()
  const cardConfirm = pageA.locator('article', { hasText: slot })
  await expect(cardConfirm.getByText('Emma Rey')).toBeVisible()
  await cardConfirm.getByRole('button', { name: 'Confirmer' }).click()

  // La demande passe en « Pourvue » dans les demandes passées.
  const pourvue = pageA.locator('article', { hasText: slot })
  await expect(pourvue.getByText('Pourvue')).toBeVisible()
  await expect(pourvue.getByText('Confirmé·e')).toBeVisible()

  await ctxA.close()
  await ctxB.close()
})
