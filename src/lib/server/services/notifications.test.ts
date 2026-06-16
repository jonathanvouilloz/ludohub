import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../db/notifications.js', () => ({
  countActionRequired: vi.fn(),
  listForRecipient: vi.fn(),
  markAllRead: vi.fn(),
  markRead: vi.fn(),
}))

import {
  countActionRequired,
  listForRecipient,
  markAllRead,
  markRead,
} from '../db/notifications.js'
import {
  getBadgeCount,
  getInbox,
  read,
  readAll,
  NotificationServiceError,
} from './notifications.js'

const LUDO = 'ludo-a'
const MEMBER = 'member-1'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getBadgeCount', () => {
  it('délègue le décompte action_required à la couche db', async () => {
    vi.mocked(countActionRequired).mockResolvedValue(3)
    expect(await getBadgeCount(LUDO, MEMBER)).toBe(3)
    expect(countActionRequired).toHaveBeenCalledWith(LUDO, MEMBER)
  })
})

describe('getInbox', () => {
  it('regroupe par domaine et masque les groupes vides', async () => {
    vi.mocked(listForRecipient).mockResolvedValue([
      { id: 'n1', type: 'theme_request' },
      { id: 'n2', type: 'absence_approved' },
      { id: 'n3', type: 'theme_request_confirmed' },
    ] as never)

    const groups = await getInbox(LUDO, MEMBER)
    expect(groups.map((g) => g.domain)).toEqual(['themes', 'absences'])
    const themes = groups.find((g) => g.domain === 'themes')
    expect(themes?.items.map((n) => n.id)).toEqual(['n1', 'n3'])
  })
})

describe('read', () => {
  it('marque lue quand le destinataire correspond', async () => {
    vi.mocked(markRead).mockResolvedValue({ id: 'n1' } as never)
    await expect(read('n1', LUDO, MEMBER)).resolves.toBeUndefined()
    expect(markRead).toHaveBeenCalledWith('n1', LUDO, MEMBER)
  })

  it("échoue si la notif n'est pas visible par le destinataire", async () => {
    vi.mocked(markRead).mockResolvedValue(undefined)
    await expect(read('n1', LUDO, MEMBER)).rejects.toThrow(NotificationServiceError)
  })
})

describe('readAll', () => {
  it('délègue à markAllRead', async () => {
    await readAll(LUDO, MEMBER)
    expect(markAllRead).toHaveBeenCalledWith(LUDO, MEMBER)
  })
})
