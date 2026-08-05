import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../db/public-directory.js', () => ({
  deleteDraftPublicDirectoryRow: vi.fn(),
  getPublicDirectoryRowForLudo: vi.fn(),
  insertPublicDirectoryRow: vi.fn(),
  listPublicDirectoryRows: vi.fn(),
  listPublishedPublicDirectoryRows: vi.fn(),
  updatePublicDirectoryPublicationRow: vi.fn(),
  updatePublicDirectoryRow: vi.fn(),
}))
vi.mock('./public-site.js', () => ({ isPublicSiteEnabled: vi.fn() }))
vi.mock('./public-faqs.js', () => {
  class PublicFaqServiceError extends Error {}
  return {
    PublicFaqServiceError,
    validatePublicEditorialText: (value: string, label: string, max: number) => {
      const normalized = value.trim()
      if (!normalized || normalized.length > max)
        throw new PublicFaqServiceError(`${label} invalide.`)
      return normalized
    },
    validatePublicEditorialMarkdown: (value: string) => value.trim(),
    validatePublicSortOrder: (value: number) => value,
  }
})

import {
  getPublicDirectoryRowForLudo,
  insertPublicDirectoryRow,
  updatePublicDirectoryPublicationRow,
} from '../db/public-directory.js'
import { isPublicSiteEnabled } from './public-site.js'
import {
  createPublicDirectoryEntry,
  publishPublicDirectoryEntry,
  PublicDirectoryServiceError,
} from './public-directory.js'

const NOW = new Date('2026-08-05T12:00:00Z')
const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'entry-a',
  ludoId: 'ludo-a',
  slug: 'paquis',
  name: 'Ludothèque des Pâquis',
  descriptionMarkdown: null,
  address: null,
  postalCode: null,
  city: 'Genève',
  phone: null,
  email: null,
  website: null,
  directionsUrl: 'https://maps.example/paquis',
  officialUrl: 'https://geneve.example/paquis',
  sortOrder: 0,
  status: 'draft',
  revision: 1,
  authorMemberId: 'member-a',
  updatedByMemberId: 'member-a',
  publishedByMemberId: null,
  publishedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
  author: null,
  updatedBy: null,
  publishedBy: null,
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(insertPublicDirectoryRow).mockImplementation(async (value) => value as never)
  vi.mocked(getPublicDirectoryRowForLudo).mockResolvedValue(row() as never)
  vi.mocked(isPublicSiteEnabled).mockResolvedValue(true)
  vi.mocked(updatePublicDirectoryPublicationRow).mockResolvedValue(
    row({ status: 'published' }) as never,
  )
})

describe('annuaire public', () => {
  it('normalise et conserve uniquement des URL HTTP(S) et un e-mail valide', async () => {
    await createPublicDirectoryEntry(
      'ludo-a',
      'member-a',
      {
        slug: 'Ludo Pâquis',
        name: 'Ludothèque des Pâquis',
        city: 'Genève',
        email: 'CONTACT@EXAMPLE.CH',
        website: 'https://example.ch',
        directionsUrl: 'https://maps.example/paquis',
        officialUrl: 'http://geneve.example/paquis',
        sortOrder: 10,
      },
      NOW,
    )
    expect(insertPublicDirectoryRow).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: 'ludo-paquis',
        email: 'contact@example.ch',
        website: 'https://example.ch/',
        directionsUrl: 'https://maps.example/paquis',
        officialUrl: 'http://geneve.example/paquis',
        status: 'draft',
      }),
    )
  })

  it.each([
    ['directionsUrl', 'javascript:alert(1)'],
    ['officialUrl', 'data:text/html,test'],
    ['website', 'ftp://example.ch'],
    ['email', 'invalide'],
  ])('refuse %s invalide', async (field, value) => {
    await expect(
      createPublicDirectoryEntry('ludo-a', 'member-a', {
        slug: 'paquis',
        name: 'Pâquis',
        city: 'Genève',
        directionsUrl: 'https://maps.example/paquis',
        officialUrl: 'https://geneve.example/paquis',
        sortOrder: 0,
        [field]: value,
      }),
    ).rejects.toBeInstanceOf(PublicDirectoryServiceError)
  })

  it('refuse la publication quand le module public est désactivé', async () => {
    vi.mocked(isPublicSiteEnabled).mockResolvedValueOnce(false)
    await expect(publishPublicDirectoryEntry('entry-a', 'ludo-a', 'member-a', 1)).rejects.toThrow(
      /module public/,
    )
    expect(updatePublicDirectoryPublicationRow).not.toHaveBeenCalled()
  })
})
