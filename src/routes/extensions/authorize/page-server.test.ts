import { describe, expect, it, vi } from 'vitest'

const resolve = vi.hoisted(() => vi.fn())
vi.mock('$lib/server/ludo-context.js', () => ({ resolveSessionContext: resolve }))
vi.mock('$lib/utils/permissions.js', () => ({ isResponsable: () => true }))
vi.mock('$lib/server/services/extension-auth.js', () => ({
  approveDeviceAuthorization: vi.fn(),
  ExtensionAuthError: class extends Error {},
}))

import { load } from './+page.server.js'

describe('liaison avant connexion', () => {
  it('conserve le user_code dans l’URL/page sans cookie ni redirection', async () => {
    resolve.mockResolvedValue(null)
    const result = await load({
      url: new URL('https://app.test/extensions/authorize?user_code=ABCD-EFGH'),
    } as never)
    expect(result).toEqual({ connected: false, userCode: 'ABCD-EFGH', ludoName: null })
  })
})
