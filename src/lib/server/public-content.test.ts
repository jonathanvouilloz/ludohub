import { describe, expect, it } from 'vitest'
import {
  createDraftPublicationState,
  PublicContentTransitionError,
  transitionPublicContent,
} from './public-content.js'

const FIRST = new Date('2026-08-05T10:00:00Z')
const LATER = new Date('2026-08-06T12:00:00Z')

describe('transitionPublicContent', () => {
  it('date la première publication et met updatedAt explicitement', () => {
    expect(
      transitionPublicContent({ status: 'draft', publishedAt: null }, 'published', FIRST),
    ).toEqual({ status: 'published', publishedAt: FIRST, updatedAt: FIRST })
  })

  it('conserve publishedAt au masquage puis à la republication', () => {
    const hidden = transitionPublicContent(
      { status: 'published', publishedAt: FIRST },
      'hidden',
      LATER,
    )
    expect(hidden).toEqual({ status: 'hidden', publishedAt: FIRST, updatedAt: LATER })
    expect(
      transitionPublicContent(hidden, 'published', new Date('2026-08-07T09:00:00Z')),
    ).toMatchObject({ status: 'published', publishedAt: FIRST })
  })

  it('refuse de ramener un contenu publié en brouillon', () => {
    expect(() =>
      transitionPublicContent({ status: 'published', publishedAt: FIRST }, 'draft', LATER),
    ).toThrow(PublicContentTransitionError)
  })

  it('crée un brouillon sans date de publication', () => {
    expect(createDraftPublicationState(FIRST)).toEqual({
      status: 'draft',
      publishedAt: null,
      updatedAt: FIRST,
    })
  })
})
