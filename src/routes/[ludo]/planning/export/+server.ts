import { error } from '@sveltejs/kit'
import * as XLSX from 'xlsx'
import { getActiveSeason, getSeasonGrid } from '$lib/server/services/planning.js'
import { requireLudoContext } from '$lib/server/ludo-context.js'
import { toPlanningExportRows, type PlanningSlot } from '$lib/planning/export.js'
import type { RequestHandler } from './$types'

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

function toExcelDate(date: string): Date {
  // Midi évite qu'Excel ne décale la date selon le fuseau de l'ordinateur.
  return new Date(`${date}T12:00:00`)
}

function configureSheet(sheet: XLSX.WorkSheet, columnWidths: number[], lastRow: number) {
  sheet['!cols'] = columnWidths.map((wch) => ({ wch }))
  sheet['!autofilter'] = { ref: `A4:E${Math.max(lastRow, 4)}` }
  // Pris en charge par les versions récentes d'Excel et ignoré sans effet par les autres lecteurs.
  sheet['!freeze'] = { xSplit: 0, ySplit: 4 }
}

export const GET: RequestHandler = async (event) => {
  const { ludo, member } = await requireLudoContext(event)
  const activeSeason = await getActiveSeason(ludo.id)
  if (!activeSeason) throw error(404, 'Aucune saison active.')

  const grid = await getSeasonGrid(activeSeason.id, ludo.id)
  const slots = grid.slots as PlanningSlot[]
  const rows = toPlanningExportRows(slots, member.id)

  const completeSheet = XLSX.utils.aoa_to_sheet(
    [
      ['Planning des samedis'],
      [`${ludo.name} — ${activeSeason.name}`],
      [`Export personnel de ${member.name}`],
      ['Date', 'Statut', 'Équipe', 'Effectif', 'Mon service'],
      ...rows.map((row) => [
        toExcelDate(row.date),
        row.status,
        row.team,
        `${row.filledCount}/${row.requiredCount}`,
        row.isMine ? 'Oui' : '',
      ]),
    ],
    { cellDates: true },
  )
  for (const rowNumber of rows.map((_, index) => index + 5)) {
    const cell = completeSheet[`A${rowNumber}`]
    if (cell) cell.z = 'dd.mm.yyyy'
  }
  configureSheet(completeSheet, [16, 28, 38, 12, 15], rows.length + 4)

  const myRows = rows.filter((row) => row.isMine)
  const myServicesSheet = XLSX.utils.aoa_to_sheet(
    [
      ['Mes samedis'],
      [`${ludo.name} — ${activeSeason.name}`],
      [`${member.name}`],
      ['Date', 'Statut', 'Équipe', 'Effectif', 'Absence signalée'],
      ...myRows.map((row) => [
        toExcelDate(row.date),
        row.status,
        row.team,
        `${row.filledCount}/${row.requiredCount}`,
        row.hasAbsence ? 'Oui' : '',
      ]),
    ],
    { cellDates: true },
  )
  for (const rowNumber of myRows.map((_, index) => index + 5)) {
    const cell = myServicesSheet[`A${rowNumber}`]
    if (cell) cell.z = 'dd.mm.yyyy'
  }
  configureSheet(myServicesSheet, [16, 28, 38, 12, 18], myRows.length + 4)

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, completeSheet, 'Planning complet')
  XLSX.utils.book_append_sheet(workbook, myServicesSheet, 'Mes samedis')

  const content = XLSX.write(workbook, { bookType: 'xlsx', type: 'array', cellDates: true })
  const filename = `planning-samedis-${activeSeason.startDate}.xlsx`

  return new Response(content, {
    headers: {
      'Content-Type': XLSX_MIME,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
