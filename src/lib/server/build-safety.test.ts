import { beforeEach, describe, expect, it, vi } from 'vitest'
import dashboardSource from './services/dashboard.ts?raw'
import navConfigSource from '../components/nav/nav-config.ts?raw'

const { betterAuth, drizzle, drizzleAdapter, neon, privateEnv } = vi.hoisted(() => ({
  neon: vi.fn(() => vi.fn()),
  drizzle: vi.fn(() => ({ select: vi.fn() })),
  betterAuth: vi.fn(() => ({ handler: vi.fn() })),
  drizzleAdapter: vi.fn(() => ({})),
  privateEnv: { ...process.env } as Record<string, string | undefined>,
}))

vi.mock('$env/dynamic/private', () => ({ env: privateEnv }))
vi.mock('@neondatabase/serverless', () => ({ neon }))
vi.mock('drizzle-orm/neon-http', () => ({ drizzle }))
vi.mock('better-auth/minimal', () => ({ betterAuth }))
vi.mock('better-auth/adapters/drizzle', () => ({ drizzleAdapter }))

describe('imports serveur sûrs pendant le build', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('importe la base sans créer de client ni exiger DATABASE_URL', async () => {
    const previous = privateEnv.DATABASE_URL
    delete privateEnv.DATABASE_URL

    try {
      const { getDb } = await import('./db/index.js')

      expect(neon).not.toHaveBeenCalled()
      expect(drizzle).not.toHaveBeenCalled()
      expect(() => getDb()).toThrow('DATABASE_URL is not set')
    } finally {
      if (previous === undefined) delete privateEnv.DATABASE_URL
      else privateEnv.DATABASE_URL = previous
    }
  })

  it('importe Better Auth sans construire son adaptateur ni toucher la base', async () => {
    await import('./auth.js')

    expect(betterAuth).not.toHaveBeenCalled()
    expect(drizzleAdapter).not.toHaveBeenCalled()
    expect(neon).not.toHaveBeenCalled()
    expect(drizzle).not.toHaveBeenCalled()
  })

  it('désactive explicitement la télémétrie au premier usage de Better Auth', async () => {
    const { getAuth } = await import('./auth.js')

    getAuth()

    expect(betterAuth).toHaveBeenCalledOnce()
    expect(betterAuth).toHaveBeenCalledWith(
      expect.objectContaining({ telemetry: { enabled: false } }),
    )
  })

  it('importe le hook SvelteKit sans initialiser de ressource d’exécution', async () => {
    const { handle } = await import('../../hooks.server.js')

    expect(handle).toBeTypeOf('function')
    expect(betterAuth).not.toHaveBeenCalled()
    expect(drizzleAdapter).not.toHaveBeenCalled()
    expect(neon).not.toHaveBeenCalled()
    expect(drizzle).not.toHaveBeenCalled()
  })
})

describe('chemins dynamiques sûrs pour le traceur de fichiers', () => {
  it('ne stocke pas une base tenant absolue dans les modules serveur', () => {
    const dynamicAbsoluteBase = /const\s+base\s*=\s*`\/\$\{/u

    expect(dashboardSource).not.toMatch(dynamicAbsoluteBase)
    expect(navConfigSource).not.toMatch(dynamicAbsoluteBase)
  })
})

describe('shim de télémétrie Better Auth', () => {
  it('ne collecte et ne publie aucune donnée', async () => {
    const { createTelemetry, getTelemetryAuthConfig } =
      await import('./better-auth-telemetry-shim.js')
    const telemetry = await createTelemetry({ telemetry: { enabled: false } })

    await expect(
      telemetry.publish({ type: 'test', payload: { secret: 'jamais collecté' } }),
    ).resolves.toBeUndefined()
    await expect(getTelemetryAuthConfig({})).resolves.toEqual({})
  })
})
