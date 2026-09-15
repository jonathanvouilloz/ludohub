import { describe, expect, it } from 'vitest'
import { groupPlanningSlotsByMonth, toPlanningExportRows, type PlanningSlot } from './export.js'

const slot = (date: string, memberIds: string[], options: Partial<PlanningSlot> = {}) =>
  ({
    id: date,
    seasonId: 'season-1',
    date,
    type: 'normal',
    requiredCount: 2,
    isCancelled: false,
    closure: null,
    assignments: memberIds.map((id) => ({
      id: `${date}-${id}`,
      slotId: date,
      memberId: id,
      member: { id, name: id === 'me' ? 'Camille' : 'Sacha' },
      absence: null,
    })),
    ...options,
  }) as PlanningSlot

describe('export du planning', () => {
  it('marque les samedis de la personne connectée et conserve l’état du samedi', () => {
    const [row] = toPlanningExportRows(
      [slot('2026-09-12', ['me', 'other'], { isCancelled: true })],
      'me',
    )

    expect(row).toMatchObject({
      date: '2026-09-12',
      status: 'Fermé',
      team: 'Camille, Sacha',
      filledCount: 2,
      requiredCount: 2,
      isMine: true,
    })
  })

  it('regroupe les samedis par mois sans les réordonner', () => {
    const groups = groupPlanningSlotsByMonth([
      slot('2026-09-05', []),
      slot('2026-09-12', []),
      slot('2026-10-03', []),
    ])

    expect(groups.map((group) => group.slots.length)).toEqual([2, 1])
  })
})
