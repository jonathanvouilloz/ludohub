import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const page = () => readFile(new URL('./+page.svelte', import.meta.url), 'utf8')

describe('gestion UI des inscriptions aux activités', () => {
  it('réserve les réglages et les données personnelles aux responsables', async () => {
    const source = await page()
    expect(source).toContain('{#if data.canManageRegistrations}')
    expect(source).toContain('action="?/registrationSettings"')
    expect(source).toContain('name="capacity"')
    expect(source).toContain('Les coordonnées sont privées et visibles uniquement ici.')
    expect(source).toContain('registration.contactName')
    expect(source).toContain('registration.email')
  })

  it('expose filtres, détail et transition CAS sans annulation publique', async () => {
    const source = await page()
    expect(source).toContain('name="registrationActivity"')
    expect(source).toContain('name="registrationStatus"')
    expect(source).toContain('action="?/registrationStatus"')
    expect(source).toContain('value={registration.revision}')
    expect(source).toContain('Annulée par l’équipe')
    expect(source).not.toContain('annulation autonome')
  })
})
