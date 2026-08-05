import { describe, expect, it } from 'vitest'
import {
  createAuthorizedMediaScope,
  isManagedPublicSitePath,
  MediaPathError,
  publicSiteMediaPath,
} from './paths.js'

const LUDO = '11111111-1111-4111-8111-111111111111'
const ENTITY = '22222222-2222-4222-8222-222222222222'
const BLOB = '33333333-3333-4333-8333-333333333333'
const scope = createAuthorizedMediaScope({ ludoId: LUDO, domain: 'activities', entityId: ENTITY })

describe('publicSiteMediaPath', () => {
  it('construit le préfixe tenant/domaine/contenu et dérive l’extension du MIME', () => {
    expect(publicSiteMediaPath({ scope, mediaType: 'image/webp', blobId: BLOB })).toBe(
      `public-site/${LUDO}/activities/${ENTITY}/${BLOB}.webp`,
    )
  })

  it('refuse les identifiants utilisables pour injecter un chemin', () => {
    expect(() =>
      createAuthorizedMediaScope({ ludoId: '../autre', domain: 'gallery', entityId: ENTITY }),
    ).toThrow(MediaPathError)
  })

  it('refuse à l’exécution un domaine hors de l’union fermée', () => {
    expect(() =>
      createAuthorizedMediaScope({ ludoId: LUDO, domain: 'themes' as never, entityId: ENTITY }),
    ).toThrow(/Domaine/)
  })

  it('reconnaît uniquement les chemins public-site gérés', () => {
    const valid = `public-site/${LUDO}/documents/${ENTITY}/${BLOB}.pdf`
    expect(isManagedPublicSitePath(valid)).toBe(true)
    expect(isManagedPublicSitePath(`themes/${ENTITY}/${BLOB}.jpg`)).toBe(false)
    expect(isManagedPublicSitePath(`public-site/${LUDO}/inconnu/${ENTITY}/${BLOB}.pdf`)).toBe(false)
  })
})
