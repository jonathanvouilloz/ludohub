import { describe, expect, it } from 'vitest'
import hoursEditorSource from './OpeningHoursEditor.svelte?raw'
import siteEditorSource from './SiteEditor.svelte?raw'

describe('édition des horaires', () => {
  it('conserve la saisie locale tant que le formulaire est modifié', () => {
    expect(siteEditorSource).toContain(
      'if (!dirty) openingHours = site.openingHours.map((row) => ({ ...row }))',
    )
  })

  it('met à jour les plages dès la saisie avant la soumission', () => {
    expect(hoursEditorSource).toContain(
      "oninput={(event) => update(entry.index, 'opensAt', event.currentTarget.value)}",
    )
    expect(hoursEditorSource).toContain(
      "oninput={(event) => update(entry.index, 'closesAt', event.currentTarget.value)}",
    )
  })
})
