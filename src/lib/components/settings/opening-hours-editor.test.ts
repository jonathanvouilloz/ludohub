import { describe, expect, it } from 'vitest'
import hoursEditorSource from './OpeningHoursEditor.svelte?raw'
import siteEditorSource from './SiteEditor.svelte?raw'

describe('édition des horaires', () => {
  it('conserve la saisie locale tant que le formulaire est modifié', () => {
    expect(siteEditorSource).toContain(
      'if (!dirty) openingHours = site.openingHours.map((row) => ({ ...row }))',
    )
  })

  it('propose uniquement des créneaux par quarts d’heure', () => {
    expect(hoursEditorSource).toContain('const TIME_OPTIONS = Array.from({ length: 96 }')
    expect(hoursEditorSource).toContain('<select')
    expect(hoursEditorSource).toContain(
      "onchange={(event) => update(entry.index, 'opensAt', event.currentTarget.value)}",
    )
    expect(hoursEditorSource).toContain(
      "onchange={(event) => update(entry.index, 'closesAt', event.currentTarget.value)}",
    )
  })
})
