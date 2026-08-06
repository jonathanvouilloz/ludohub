import { timingSafeEqual } from 'node:crypto'
import { env } from '$env/dynamic/private'
import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { purgeDueFamilySubmissions } from '$lib/server/services/family-registrations.js'

function authorized(request: Request) {
  const expected = env.CRON_SECRET
  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  if (!expected || !provided) return false
  const a = Buffer.from(expected); const b = Buffer.from(provided)
  return a.length === b.length && timingSafeEqual(a, b)
}
const run: RequestHandler = async ({ request }) => {
  const headers = { 'Cache-Control': 'no-store' }
  if (!authorized(request)) return json({ error: 'Unauthorized' }, { status: 401, headers })
  return json(await purgeDueFamilySubmissions(), { headers })
}
export const GET = run
export const POST = run
