import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const activityList = () => readFile(new URL('./+page.svelte', import.meta.url), 'utf8')
const activityDetail = () => readFile(new URL('./[id]/+page.svelte', import.meta.url), 'utf8')
const registrationList = () =>
  readFile(new URL('../inscriptions/+page.svelte', import.meta.url), 'utf8')
const registrationDetail = () =>
  readFile(new URL('../inscriptions/[id]/+page.svelte', import.meta.url), 'utf8')

describe('gestion UI des inscriptions aux activités', () => {
  it('réserve les réglages et les données personnelles aux responsables', async () => {
    const [list, activity, registration] = await Promise.all([
      activityList(),
      activityDetail(),
      registrationDetail(),
    ])
    expect(list).toContain('{#if data.canManageRegistrations}')
    expect(list).toContain('/site-public/inscriptions')
    expect(activity).toContain('action="?/registrationSettings"')
    expect(activity).toContain('name="capacity"')
    expect(registration).toContain('item.contactName')
    expect(registration).toContain('item.email')
  })

  it('expose filtres, détail et transition CAS sans annulation publique', async () => {
    const [list, detail] = await Promise.all([registrationList(), registrationDetail()])
    expect(list).toContain('name="registrationActivity"')
    expect(list).toContain('name="registrationStatus"')
    expect(detail).toContain('action="?/registrationStatus"')
    expect(detail).toContain('value={item.revision}')
    expect(detail).toContain('Annulée')
    expect(detail).not.toContain('annulation autonome')
  })
})
