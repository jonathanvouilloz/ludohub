import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const page = () => readFile(new URL('./+page.svelte', import.meta.url), 'utf8')
const form = () =>
  readFile(
    new URL('../../../../lib/components/public-site/TopThreeForm.svelte', import.meta.url),
    'utf8',
  )

describe('liste des Top 3', () => {
  it('se limite à ouvrir, signaler l’accueil et supprimer avec CAS', async () => {
    const source = await page()
    expect(source).toContain('Sur l’accueil')
    expect(source).toContain('action="?/delete"')
    expect(source).toContain('name="revision"')
    expect(source).toContain('/nouveau')
  })

  it('ne réexpose ni cycle de publication ni ciblage ni upload par jeu', async () => {
    const source = await page()
    for (const removed of [
      'action="?/homepage"',
      'action="?/publication"',
      'action="?/uploadGameImage"',
      'action="?/removeGameImage"',
      'Publier',
      'Masquer',
      'Brouillon',
      'targetMode',
    ]) {
      expect(source).not.toContain(removed)
    }
  })
})

describe('formulaire unique du Top 3', () => {
  it('porte le nom, les trois jeux avec photo et la case d’accueil dans un seul envoi', async () => {
    const source = await form()
    expect(source).toContain('enctype="multipart/form-data"')
    expect(source).toContain('name="theme"')
    expect(source).toContain('name={`image${index}`}')
    expect(source).toContain('name={`name${index}`}')
    expect(source).toContain('name={`description${index}`}')
    expect(source).toContain('name={`removeImage${index}`}')
    expect(source).toContain('name="isHomepage"')
    expect(source).toContain('compressEditorialImageFields')
  })

  it('ne demande ni slug, ni texte alternatif, ni lieu', async () => {
    const source = await form()
    for (const removed of ['name="slug"', 'name="alt"', 'name="siteIds"', 'targetMode']) {
      expect(source).not.toContain(removed)
    }
  })
})
