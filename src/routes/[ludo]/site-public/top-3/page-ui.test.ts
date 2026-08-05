import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const page = () => readFile(new URL('./+page.svelte', import.meta.url), 'utf8')

describe('sélection du Top 3 sur l’accueil', () => {
  it('réserve l’action aux Top 3 publiés et affiche l’état sélectionné', async () => {
    const source = await page()
    expect(source).toContain("{#if item.status === 'published'}")
    expect(source).toContain('Afficher sur l’accueil')
    expect(source).toContain('Retirer de l’accueil')
    expect(source).toContain('Sur l’accueil')
    expect(source).toContain('action="?/homepage"')
    expect(source).toContain('name="revision"')
  })

  it('explique le retrait atomique lors du masquage', async () => {
    const source = await page()
    expect(source).toContain('Top 3 masqué et retiré de l’accueil.')
  })
})
