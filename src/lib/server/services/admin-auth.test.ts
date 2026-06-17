import type { Cookies } from '@sveltejs/kit'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('$env/dynamic/private', () => ({
  env: { BETTER_AUTH_SECRET: 'test-secret', SUPER_ADMIN_PASSWORD: 'top-secret-42' },
}))

import {
  ADMIN_COOKIE,
  clearAdminSession,
  readAdminSession,
  setAdminSessionCookie,
  verifyAdminPassword,
} from './admin-auth.js'

/** Faux `Cookies` minimal basé sur une Map. */
function fakeCookies(): Cookies {
  const store = new Map<string, string>()
  return {
    get: (k: string) => store.get(k),
    set: (k: string, v: string) => store.set(k, v),
    delete: (k: string) => store.delete(k),
  } as unknown as Cookies
}

beforeEach(() => vi.clearAllMocks())

describe('verifyAdminPassword', () => {
  it('accepte le bon mot de passe', async () => {
    expect(await verifyAdminPassword('top-secret-42')).toBe(true)
  })

  it('refuse un mauvais mot de passe', async () => {
    expect(await verifyAdminPassword('wrong')).toBe(false)
  })
})

describe('session admin (round-trip)', () => {
  it('pose puis relit une session valide', async () => {
    const cookies = fakeCookies()
    await setAdminSessionCookie(cookies)
    expect(await readAdminSession(cookies)).toEqual({ admin: true })
  })

  it('retourne null sans cookie', async () => {
    expect(await readAdminSession(fakeCookies())).toBeNull()
  })

  it('rejette une signature falsifiée', async () => {
    const cookies = fakeCookies()
    await setAdminSessionCookie(cookies)
    cookies.set(ADMIN_COOKIE, `${cookies.get(ADMIN_COOKIE)}tampered`, { path: '/' })
    expect(await readAdminSession(cookies)).toBeNull()
  })

  it('clearAdminSession supprime le cookie', async () => {
    const cookies = fakeCookies()
    await setAdminSessionCookie(cookies)
    clearAdminSession(cookies)
    expect(await readAdminSession(cookies)).toBeNull()
  })
})
