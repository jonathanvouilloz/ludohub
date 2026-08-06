import { beforeEach, describe, expect, it, vi } from 'vitest'

const getLudoBySlug = vi.hoisted(() => vi.fn())
const listActiveSiteRows = vi.hoisted(() => vi.fn())
const emitAuditEvent = vi.hoisted(() => vi.fn())
const db = vi.hoisted(() => ({
  getConfig: vi.fn(), getReceipt: vi.fn(), insert: vi.fn(), getForm: vi.fn(), createForm: vi.fn(),
  updateForm: vi.fn(), listDocuments: vi.fn(), createDocument: vi.fn(), versionDocument: vi.fn(),
  publish: vi.fn(), listSubmissions: vi.fn(), getSubmission: vi.fn(), process: vi.fn(), payment: vi.fn(),
  purge: vi.fn(),
}))
vi.mock('../db/ludotheques.js', () => ({ getLudoBySlug }))
vi.mock('../db/sites.js', () => ({ listActiveSiteRows }))
vi.mock('./events.js', () => ({ emitAuditEvent }))
vi.mock('../db/family-registrations.js', () => ({
  getPublishedFamilyConfigRow: db.getConfig,
  getFamilySubmissionReceiptByKey: db.getReceipt,
  insertFamilySubmissionAtomic: db.insert,
  getFamilyRegistrationFormForLudo: db.getForm,
  createFamilyRegistrationFormRow: db.createForm,
  updateFamilyRegistrationFormRow: db.updateForm,
  listFamilyDocumentRows: db.listDocuments,
  createFamilyDocumentAtomic: db.createDocument,
  versionFamilyDocumentAtomic: db.versionDocument,
  publishFamilyFormAtomic: db.publish,
  listFamilySubmissionRows: db.listSubmissions,
  getFamilySubmissionRowForLudo: db.getSubmission,
  processFamilySubmissionAtomic: db.process,
  recordFamilyPaymentAtomic: db.payment,
  purgeDueFamilySubmissionsRow: db.purge,
}))

import { ensureFamilyForm, purgeDueFamilySubmissions, recordFamilyPayment, submitPublicFamilyMembership, updateFamilyForm } from './family-registrations.js'

const LUDO = '10000000-0000-4000-8000-000000000001'
const SITE = '20000000-0000-4000-8000-000000000001'
const RECEIPT = '30000000-0000-4000-8000-000000000001'
const input = {
  gender: 'female', firstName: ' Ada ', lastName: ' Lovelace ', address: 'Rue 1', postalCode: '1200', city: 'Genève', phone: '+41 22 000 00 00', secondaryPhone: '', email: 'ADA@example.ch', consentAccepted: true, consentFullName: 'Ada Lovelace', consentAcceptedOn: '2026-08-06', members: [{ gender: 'male', firstName: 'Charles', lastName: 'Lovelace', birthDate: '2020-02-29' }],
}
const config = { form_id: '40000000-0000-4000-8000-000000000001', form_version_id: '50000000-0000-4000-8000-000000000001', version: 1, max_members: 20, consent_label: 'Texte validé', documents: [{ id: 'd', title: 'Règles', requiredAcceptance: true }] }

beforeEach(() => {
  vi.clearAllMocks(); getLudoBySlug.mockResolvedValue({ id: LUDO }); listActiveSiteRows.mockResolvedValue([{ id: SITE, name: 'Centre' }]); db.getConfig.mockResolvedValue(config); db.getReceipt.mockResolvedValue(undefined); db.insert.mockImplementation(async (value) => ({ id: value.id })); db.getSubmission.mockResolvedValue({ id: RECEIPT });
})

describe('soumission familiale idempotente', () => {
  it('normalise la famille et ne met aucun UUID serveur dans le fingerprint', async () => {
    const result = await submitPublicFamilyMembership('demo', 'request-0000000001', input)
    expect(result.created).toBe(true)
    expect(db.insert).toHaveBeenCalledWith(expect.objectContaining({ ludoId: LUDO, siteId: SITE, email: 'ada@example.ch', fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/) }))
    expect(JSON.stringify(result)).not.toMatch(/Ada|example\.ch/)
  })

  it('rejoue après désactivation ou republication sans relire la configuration ni les sites', async () => {
    await submitPublicFamilyMembership('demo', 'request-0000000001', input)
    const written = db.insert.mock.calls[0][0]
    db.getReceipt.mockResolvedValue({ receiptId: RECEIPT, requestFingerprint: written.fingerprint, submittedAt: new Date('2026-08-06T10:00:00Z'), purgedAt: new Date() })
    db.getConfig.mockClear(); listActiveSiteRows.mockClear(); db.insert.mockClear()
    await expect(submitPublicFamilyMembership('demo', 'request-0000000001', input)).resolves.toMatchObject({ receiptId: RECEIPT, created: false })
    expect(db.getConfig).not.toHaveBeenCalled(); expect(listActiveSiteRows).not.toHaveBeenCalled(); expect(db.insert).not.toHaveBeenCalled()
  })

  it('refuse la même clé avec un corps différent', async () => {
    await submitPublicFamilyMembership('demo', 'request-0000000001', input)
    db.getReceipt.mockResolvedValue({ receiptId: RECEIPT, requestFingerprint: db.insert.mock.calls[0][0].fingerprint, submittedAt: new Date() })
    await expect(submitPublicFamilyMembership('demo', 'request-0000000001', { ...input, city: 'Carouge' })).rejects.toMatchObject({ code: 'conflict' })
  })

  it.each([['membre null', { ...input, members: [null] }], ['date impossible', { ...input, consentAcceptedOn: '2026-02-30' }]])('rejette %s sans erreur interne', async (_label, invalid) => {
    await expect(submitPublicFamilyMembership('demo', 'request-0000000001', invalid as never)).rejects.toMatchObject({ code: 'invalid' })
  })

  it('exige un site explicite lorsqu’il y en a plusieurs', async () => {
    listActiveSiteRows.mockResolvedValue([{ id: SITE }, { id: 'another' }])
    await expect(submitPublicFamilyMembership('demo', 'request-0000000001', input)).rejects.toMatchObject({ code: 'invalid' })
  })
})

describe('gestion responsable', () => {
  it('absorbe la course de création du formulaire puis relit le gagnant', async () => {
    db.getForm.mockResolvedValueOnce(undefined).mockResolvedValueOnce({ id: 'winner', revision: 1 })
    db.createForm.mockResolvedValueOnce(undefined)
    await expect(ensureFamilyForm(LUDO, 'member')).resolves.toMatchObject({ id: 'winner' })
  })
  it('audite une configuration sans inclure son texte', async () => {
    db.getForm.mockResolvedValue({ id: 'form', revision: 1 }); db.updateForm.mockResolvedValue({ id: 'form', revision: 2 })
    await updateFamilyForm(LUDO, 'member', { revision: 1, title: 'Adhésion secrète', intro: null, consentLabel: 'Texte privé', enabled: true, maxMembers: 20, retentionDays: 30, annualFeeCents: 3000, allowsTwint: true, allowsCash: true })
    expect(emitAuditEvent).toHaveBeenCalled(); expect(JSON.stringify(emitAuditEvent.mock.calls)).not.toMatch(/secrète|Texte privé/)
  })

  it('ne prétend pas enregistrer un paiement rejeté par les invariants SQL', async () => {
    db.payment.mockResolvedValue(undefined)
    await expect(recordFamilyPayment(RECEIPT, LUDO, 'member', 'twint', 1)).rejects.toMatchObject({ code: 'conflict' })
    expect(emitAuditEvent).not.toHaveBeenCalled()
  })
})

describe('job de purge borné', () => {
  it('enchaîne les lots complets et s’arrête au premier lot partiel', async () => {
    db.purge.mockResolvedValueOnce(100).mockResolvedValueOnce(100).mockResolvedValueOnce(7)
    await expect(purgeDueFamilySubmissions(new Date('2026-09-01T00:00:00Z'))).resolves.toEqual({ purged: 207, batches: 3, hasMore: false })
    expect(db.purge).toHaveBeenCalledTimes(3)
  })
  it('borne strictement le nombre de lots', async () => {
    db.purge.mockResolvedValue(10)
    await expect(purgeDueFamilySubmissions(new Date(), 10, 2)).resolves.toEqual({ purged: 20, batches: 2, hasMore: true })
    expect(db.purge).toHaveBeenCalledTimes(2)
  })
})
