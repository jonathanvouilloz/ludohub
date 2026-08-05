import { describe, expect, it } from 'vitest'
import { buildNavConfig, isNavDestinationVisible } from './nav-config.js'

const publicSite = buildNavConfig('demo').find((destination) => destination.publicSiteOnly)!

describe('navigation Site public', () => {
  it('reste masquée pour un membre lorsque le module est désactivé', () => {
    expect(
      isNavDestinationVisible(publicSite, {
        zone: 'sidebar',
        responsable: false,
        publicSiteEnabled: false,
      }),
    ).toBe(false)
  })

  it('apparaît pour un membre lorsque son tenant est activé', () => {
    expect(
      isNavDestinationVisible(publicSite, {
        zone: 'sidebar',
        responsable: false,
        publicSiteEnabled: true,
      }),
    ).toBe(true)
  })

  it("reste visible au responsable d'un tenant désactivé pour permettre l'activation", () => {
    expect(
      isNavDestinationVisible(publicSite, {
        zone: 'sidebar',
        responsable: true,
        publicSiteEnabled: false,
      }),
    ).toBe(true)
  })
})
