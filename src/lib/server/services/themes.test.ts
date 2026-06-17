import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../db/themes.js', () => ({
  addThemeImage: vi.fn(),
  addThemeItem: vi.fn(),
  countThemeImages: vi.fn(),
  createTheme: vi.fn(),
  deleteThemeImage: vi.fn(),
  deleteThemeItem: vi.fn(),
  getShareableThemes: vi.fn(),
  getThemeById: vi.fn(),
  getThemeImageById: vi.fn(),
  getThemeItemById: vi.fn(),
  getThemesByLudo: vi.fn(),
  updateTheme: vi.fn(),
}))

import { addThemeImage, addThemeItem, countThemeImages, getThemeById } from '../db/themes.js'
import { addItem, registerImage, ThemeServiceError } from './themes.js'

const LUDO = 'ludo-a'
const THEME = 'theme-1'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getThemeById).mockResolvedValue({
    id: THEME,
    ownerLudoId: LUDO,
    isArchived: false,
  } as never)
})

describe('registerImage', () => {
  it('enregistre une image sous la limite (non-cover)', async () => {
    vi.mocked(countThemeImages).mockResolvedValue(2)
    await registerImage(THEME, LUDO, 'https://blob/x.jpg', 'themes/x.jpg')
    expect(addThemeImage).toHaveBeenCalledWith({
      themeId: THEME,
      url: 'https://blob/x.jpg',
      storageKey: 'themes/x.jpg',
      isCover: false,
    })
  })

  it('marque la première image comme couverture', async () => {
    vi.mocked(countThemeImages).mockResolvedValue(0)
    await registerImage(THEME, LUDO, 'https://blob/x.jpg', 'themes/x.jpg')
    expect(addThemeImage).toHaveBeenCalledWith({
      themeId: THEME,
      url: 'https://blob/x.jpg',
      storageKey: 'themes/x.jpg',
      isCover: true,
    })
  })

  it('refuse au-delà de 6 photos', async () => {
    vi.mocked(countThemeImages).mockResolvedValue(6)
    await expect(registerImage(THEME, LUDO, 'u', 'k')).rejects.toThrow(/Maximum 6/)
    expect(addThemeImage).not.toHaveBeenCalled()
  })

  it('refuse sur un thème archivé', async () => {
    vi.mocked(getThemeById).mockResolvedValue({
      id: THEME,
      ownerLudoId: LUDO,
      isArchived: true,
    } as never)
    await expect(registerImage(THEME, LUDO, 'u', 'k')).rejects.toThrow(/archivé/)
  })

  it('refuse si le thème appartient à une autre ludo', async () => {
    vi.mocked(getThemeById).mockResolvedValue({
      id: THEME,
      ownerLudoId: 'autre',
      isArchived: false,
    } as never)
    await expect(registerImage(THEME, LUDO, 'u', 'k')).rejects.toThrow(ThemeServiceError)
  })
})

describe('addItem', () => {
  it('ajoute un item valide', async () => {
    await addItem(THEME, LUDO, { name: 'Dé', quantity: '4' })
    expect(addThemeItem).toHaveBeenCalledWith({ themeId: THEME, name: 'Dé', quantity: 4 })
  })

  it('refuse une quantité < 1', async () => {
    await expect(addItem(THEME, LUDO, { name: 'Dé', quantity: '0' })).rejects.toThrow(/entier ≥ 1/)
  })

  it('refuse un nom vide', async () => {
    await expect(addItem(THEME, LUDO, { name: '   ', quantity: '1' })).rejects.toThrow(
      /nom est requis/,
    )
  })
})
