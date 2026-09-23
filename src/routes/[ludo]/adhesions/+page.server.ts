import { error, fail } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import { requireResponsableContext } from '$lib/server/ludo-context.js'
import { FamilyRegistrationServiceError, ensureFamilyForm, getFamilyFormManagement, getFamilySubmission, listFamilySubmissions, processFamilySubmission, publishFamilyForm, recordFamilyPayment, saveFamilyDocument, updateFamilyForm } from '$lib/server/services/family-registrations.js'

export const load: PageServerLoad = async (event) => {
  const { ludo, member } = await requireResponsableContext(event)
  await ensureFamilyForm(ludo.id, member.id)
  const selectedId = event.url.searchParams.get('id')
  let selected = null
  if (selectedId) {
    try { selected = await getFamilySubmission(selectedId, ludo.id) }
    catch (cause) { if (cause instanceof FamilyRegistrationServiceError && cause.code === 'not_found') throw error(404, 'Adhésion introuvable'); throw cause }
  }
  const baseUrl = event.url.origin
  return {
    management: await getFamilyFormManagement(ludo.id),
    submissions: await listFamilySubmissions(ludo.id),
    selected,
    publicFormUrl: `${baseUrl}/formulaires/${encodeURIComponent(ludo.slug)}/adhesion`,
  }
}
const values = (data: FormData) => Object.fromEntries(data.entries())
function chfToCents(value: unknown) {
  if (typeof value !== 'string') return null
  const match = value.trim().match(/^(\d+)(?:[.,](\d{1,2}))?$/)
  if (!match) return null
  const cents = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0') || '0')
  return Number.isSafeInteger(cents) && cents <= 1_000_000 ? cents : null
}
async function wrap(run: () => Promise<unknown>) { try { await run(); return { success: true } } catch (error) { if (error instanceof FamilyRegistrationServiceError) return fail(error.code === 'conflict' ? 409 : 400, { error: error.message }); throw error } }
export const actions: Actions = {
  configuration: async (event) => { const { ludo, member } = await requireResponsableContext(event); const input = values(await event.request.formData()); const annualFeeCents = chfToCents(input.annualFeeChf); if (annualFeeCents === null) return fail(400, { error: 'Le tarif annuel doit être indiqué en francs suisses, par exemple 30.00.' }); return wrap(() => updateFamilyForm(ludo.id, member.id, { ...input, revision: Number(input.revision), retentionDays: Number(input.retentionDays), annualFeeCents, enabled: input.enabled === 'on', allowsTwint: input.allowsTwint === 'on', allowsCash: input.allowsCash === 'on' })) },
  document: async (event) => { const { ludo, member } = await requireResponsableContext(event); const management = await getFamilyFormManagement(ludo.id); if (!management) return fail(400, { error: 'Configuration absente.' }); const input = values(await event.request.formData()); return wrap(() => saveFamilyDocument(ludo.id, management.form.id, member.id, { ...input, requiredAcceptance: input.requiredAcceptance === 'on', sortOrder: Number(input.sortOrder), revision: Number(input.revision) })) },
  publish: async (event) => { const { ludo, member } = await requireResponsableContext(event); const input = values(await event.request.formData()); return wrap(() => publishFamilyForm(ludo.id, member.id, String(input.formId), Number(input.revision))) },
  process: async (event) => { const { ludo, member } = await requireResponsableContext(event); const input = values(await event.request.formData()); return wrap(() => processFamilySubmission(String(input.id), ludo.id, member.id, Number(input.revision))) },
  payment: async (event) => { const { ludo, member } = await requireResponsableContext(event); const input = values(await event.request.formData()); return wrap(() => recordFamilyPayment(String(input.id), ludo.id, member.id, input.method || null, Number(input.revision))) },
}
