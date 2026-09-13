import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFile(new URL(path, import.meta.url), 'utf8')

describe('navigation éditoriale du site public', () => {
  it('regroupe les rubriques par tâche sur l’accueil', async () => {
    const home = await source('./+page.svelte')
    expect(home).toContain('Publier')
    expect(home).toContain('Informations du site')
    expect(home).toContain('Messages et demandes')
    expect(home).toContain('/lieux-horaires`')
    expect(home).toContain('/inscriptions`')
  })

  it('sépare la liste, la fiche et le formulaire des actualités', async () => {
    const [list, detail, detailServer, editServer, createServer, form] = await Promise.all([
      source('./actualites/+page.svelte'),
      source('./actualites/[id]/+page.svelte'),
      source('./actualites/[id]/+page.server.ts'),
      source('./actualites/[id]/modifier/+page.server.ts'),
      source('./actualites/nouveau/+page.server.ts'),
      source('../../../lib/components/public-site/NewsForm.svelte'),
    ])
    expect(list).toContain('EditorialListItem')
    expect(list).not.toContain('uploadImage')
    expect(detail).toContain('action="?/uploadImage"')
    expect(detail).toContain('EditorialAssetsEditor')
    expect(detailServer).toContain("export { actions } from '../+page.server.js'")
    expect(editServer).toContain("export { actions } from '../../+page.server.js'")
    expect(createServer).toContain("export { actions } from '../+page.server.js'")
    expect(form).toContain('Options avancées')
    expect(form).toContain('Texte de l’actualité')
  })
})
