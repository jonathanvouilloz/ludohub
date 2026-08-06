import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { requireResponsableContext } from '$lib/server/ludo-context.js'
import { FamilyRegistrationServiceError, getFamilyFormManagement, getFamilySubmission, listFamilySubmissions, processFamilySubmission, publishFamilyForm, recordFamilyPayment, saveFamilyDocument, updateFamilyForm } from '$lib/server/services/family-registrations.js'
import type { FamilyRegistrationSubmissionStatus } from '$lib/server/schema.js'

const noStore = { 'Cache-Control': 'no-store' }
function handled(error: unknown) { if (!(error instanceof FamilyRegistrationServiceError)) return null; return json({ error: error.message }, { status: error.code === 'not_found' ? 404 : error.code === 'conflict' ? 409 : 400, headers: noStore }) }

export const GET: RequestHandler = async (event) => {
  const { ludo } = await requireResponsableContext(event)
  const id = event.url.searchParams.get('id')
  if (id) return json({ submission: await getFamilySubmission(id, ludo.id) }, { headers: noStore })
  const status = event.url.searchParams.get('status')
  if (status && status !== 'new' && status !== 'processed') return json({ error: 'Statut invalide.' }, { status: 400, headers: noStore })
  return json({ configuration: await getFamilyFormManagement(ludo.id), submissions: await listFamilySubmissions(ludo.id, status as FamilyRegistrationSubmissionStatus | undefined) }, { headers: noStore })
}

export const PATCH: RequestHandler = async (event) => {
  const { ludo, member } = await requireResponsableContext(event)
  let body: Record<string, unknown>
  try { body = await event.request.json(); if (!body || Array.isArray(body)) throw new Error() } catch { return json({ error: 'JSON invalide.' }, { status: 400, headers: noStore }) }
  try {
    if (body.kind === 'configuration') return json({ form: await updateFamilyForm(ludo.id, member.id, body) }, { headers: noStore })
    if (body.kind === 'document') { const management = await getFamilyFormManagement(ludo.id); if (!management) return json({ error: 'Configuration absente.' }, { status: 400, headers: noStore }); return json({ document: await saveFamilyDocument(ludo.id, management.form.id, member.id, body) }, { headers: noStore }) }
    if (body.kind === 'publish' && typeof body.formId === 'string') return json({ version: await publishFamilyForm(ludo.id, member.id, body.formId, body.revision) }, { headers: noStore })
    if (body.kind === 'process' && typeof body.id === 'string') return json({ submission: await processFamilySubmission(body.id, ludo.id, member.id, body.revision) }, { headers: noStore })
    if (body.kind === 'payment' && typeof body.id === 'string') return json({ submission: await recordFamilyPayment(body.id, ludo.id, member.id, body.method, body.revision) }, { headers: noStore })
    return json({ error: 'Requête invalide.' }, { status: 400, headers: noStore })
  } catch (error) { const response = handled(error); if (response) return response; throw error }
}
