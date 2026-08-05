import { describe, expect, it, vi } from 'vitest'
import type { StoredBlob } from './blob-storage.js'
import { MediaCompensationError, uploadAndRegisterMedia } from './media-service.js'
import { createAuthorizedMediaScope } from './paths.js'

const scope = createAuthorizedMediaScope({
  ludoId: '11111111-1111-4111-8111-111111111111',
  domain: 'gallery',
  entityId: '22222222-2222-4222-8222-222222222222',
})

const blob = {
  url: 'https://blob.test/x.jpg',
  downloadUrl: 'https://blob.test/x.jpg?download=1',
  pathname:
    'public-site/11111111-1111-4111-8111-111111111111/gallery/22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333.jpg',
  contentType: 'image/jpeg',
  size: 4,
} as StoredBlob

describe('uploadAndRegisterMedia', () => {
  it('transmet exactement le scope autorisé à chaque étape', async () => {
    const order: string[] = []
    const result = await uploadAndRegisterMedia({
      authorize: vi.fn(async () => {
        order.push('authorize')
        return scope
      }),
      upload: vi.fn(async (receivedScope) => {
        expect(receivedScope).toBe(scope)
        order.push('upload')
        return blob
      }),
      register: vi.fn(async (receivedScope) => {
        expect(receivedScope).toBe(scope)
        order.push('register')
        return { id: 'media-1' }
      }),
      cleanup: vi.fn(),
    })
    expect(order).toEqual(['authorize', 'upload', 'register'])
    expect(result).toEqual({ id: 'media-1' })
  })

  it('n’upload pas quand l’autorisation échoue', async () => {
    const upload = vi.fn()
    await expect(
      uploadAndRegisterMedia({
        authorize: async () => {
          throw new Error('forbidden')
        },
        upload,
        register: vi.fn(),
        cleanup: vi.fn(),
      }),
    ).rejects.toThrow('forbidden')
    expect(upload).not.toHaveBeenCalled()
  })

  it('n’enregistre ni ne nettoie quand l’upload lui-même échoue', async () => {
    const register = vi.fn()
    const cleanup = vi.fn()
    await expect(
      uploadAndRegisterMedia({
        authorize: vi.fn(async () => scope),
        upload: async () => {
          throw new Error('upload failed')
        },
        register,
        cleanup,
      }),
    ).rejects.toThrow('upload failed')
    expect(register).not.toHaveBeenCalled()
    expect(cleanup).not.toHaveBeenCalled()
  })

  it('supprime le Blob dans le même scope si l’enregistrement échoue', async () => {
    const registrationError = new Error('db failed')
    const cleanup = vi.fn(async () => undefined)
    await expect(
      uploadAndRegisterMedia({
        authorize: vi.fn(async () => scope),
        upload: async () => blob,
        register: async () => {
          throw registrationError
        },
        cleanup,
      }),
    ).rejects.toBe(registrationError)
    expect(cleanup).toHaveBeenCalledWith(scope, blob.pathname)
  })

  it('expose le scope et les deux erreurs si la compensation échoue', async () => {
    const registrationError = new Error('db failed')
    const cleanupError = new Error('blob failed')
    const onCompensationFailure = vi.fn()
    const promise = uploadAndRegisterMedia({
      authorize: vi.fn(async () => scope),
      upload: async () => blob,
      register: async () => {
        throw registrationError
      },
      cleanup: async () => {
        throw cleanupError
      },
      onCompensationFailure,
    })
    await expect(promise).rejects.toBeInstanceOf(MediaCompensationError)
    expect(onCompensationFailure).toHaveBeenCalledWith({
      scope,
      blob,
      registrationError,
      cleanupError,
    })
  })
})
