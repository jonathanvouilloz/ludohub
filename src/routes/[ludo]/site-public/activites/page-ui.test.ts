import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const activityList = () => readFile(new URL('./+page.svelte', import.meta.url), 'utf8')
const activityDetail = () => readFile(new URL('./[id]/+page.svelte', import.meta.url), 'utf8')
describe('simplification des activités', () => {
  it('retire les inscriptions et leurs réglages de la gestion des activités', async () => {
    const [list, detail] = await Promise.all([activityList(), activityDetail()])
    expect(list).not.toContain('/site-public/inscriptions')
    expect(list).not.toContain('canManageRegistrations')
    expect(detail).not.toContain('registrationSettings')
    expect(detail).not.toContain('Accepter les inscriptions')
  })
})
