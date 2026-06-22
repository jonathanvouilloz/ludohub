<script lang="ts">
  import { enhance } from '$app/forms'
  import { toastEnhance } from '$lib/utils/enhance'
  import { toast } from '$lib/components/ui/sonner/index.js'
  import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js'
  import { Button, buttonVariants } from '$lib/components/ui/button/index.js'
  import { Input } from '$lib/components/ui/input/index.js'
  import { Label } from '$lib/components/ui/label/index.js'
  import { StatusBadge } from '$lib/components/ui/badge/index.js'
  import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left'
  import ImageIcon from '@lucide/svelte/icons/image'
  import FileTextIcon from '@lucide/svelte/icons/file-text'
  import { renderCampaignEmail } from '$lib/email/template.js'
  import InboxPreview from '$lib/components/newsletter/InboxPreview.svelte'
  import { CONTACT_TAGS, TAG_LABELS } from '$lib/newsletter/tags'
  import type { CampaignRow } from '$lib/server/schema'

  let { data } = $props()

  // Longueurs recommandées (au-delà : troncature fréquente dans les clients mail).
  const SUBJECT_MAX = 50
  const PREVIEW_MAX = 90

  const slug = $derived(data.ludo.slug)
  const campaign = $derived(data.campaign as CampaignRow)
  const sent = $derived(campaign.status === 'sent')

  const c = $derived(campaign.content ?? { body: '' })

  // État éditable (initialisé depuis la campagne chargée).
  let subject = $state('')
  let previewText = $state('')
  let title = $state('')
  let body = $state('')
  let imageUrl = $state('')
  let ctaLabel = $state('')
  let ctaUrl = $state('')
  let pdfUrl = $state('')
  let pdfAsAttachment = $state(false)
  let testEmail = $state('')
  let targetTag = $state('')

  // (Ré)initialise après chaque chargement (save, send → reload des données).
  $effect(() => {
    subject = campaign.subject === 'Nouvelle campagne' ? '' : campaign.subject
    previewText = campaign.previewText ?? ''
    title = c.title ?? ''
    body = c.body ?? ''
    imageUrl = c.imageUrl ?? ''
    ctaLabel = c.ctaLabel ?? ''
    ctaUrl = c.ctaUrl ?? ''
    pdfUrl = c.pdfUrl ?? ''
    pdfAsAttachment = c.pdfAsAttachment ?? false
    targetTag = campaign.targetTag ?? ''
  })

  // Nombre de destinataires du segment sélectionné (`''` = tous les abonnés).
  const recipientCount = $derived(
    targetTag
      ? (data.subscribedByTag[targetTag as keyof typeof data.subscribedByTag] ?? 0)
      : data.subscribedByTag.total,
  )

  let saving = $state(false)
  let sending = $state(false)
  let testing = $state(false)
  let uploadingImage = $state(false)
  let uploadingPdf = $state(false)

  const contentObj = $derived({
    title,
    body,
    imageUrl: imageUrl || undefined,
    ctaLabel: ctaLabel || undefined,
    ctaUrl: ctaUrl || undefined,
    pdfUrl: pdfUrl || undefined,
    pdfAsAttachment,
  })
  const contentJson = $derived(JSON.stringify(contentObj))

  const previewHtml = $derived(
    renderCampaignEmail(
      contentObj,
      {
        name: data.ludo.name,
        color: data.ludo.color,
        logoUrl: data.ludo.logoUrl,
        address: data.ludo.address,
        email: data.ludo.email,
        phone: data.ludo.phone,
        website: data.ludo.website,
      },
      { unsubscribeUrl: '#', previewText, recipientFirstName: null },
    ),
  )

  // Aperçu sans flicker : on initialise l'iframe une fois avec un doc vide, puis on
  // met à jour son <body> EN PLACE (innerHTML) à chaque frappe — aucune navigation/
  // rechargement, donc plus de flash blanc. Petit debounce pour coalescer les frappes.
  const BLANK_DOC = '<!doctype html><html><body style="margin:0;background:#f0f0f0"></body></html>'
  let previewEl = $state<HTMLIFrameElement>()
  let paintTimer: ReturnType<typeof setTimeout> | undefined

  function paintPreview() {
    const doc = previewEl?.contentDocument
    if (!doc?.body) return
    const parsed = new DOMParser().parseFromString(previewHtml, 'text/html')
    doc.body.setAttribute('style', parsed.body.getAttribute('style') ?? '')
    doc.body.innerHTML = parsed.body.innerHTML
  }

  $effect(() => {
    void previewHtml // dépendance réactive
    if (!previewEl) return
    clearTimeout(paintTimer)
    paintTimer = setTimeout(paintPreview, 100)
    return () => clearTimeout(paintTimer)
  })

  async function errorMessage(res: Response): Promise<string> {
    const b = await res.json().catch(() => null)
    return b?.message ?? 'Une erreur est survenue.'
  }

  async function uploadFile(file: File | undefined, kind: 'image' | 'pdf') {
    if (!file) return null
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`/api/newsletter/upload?kind=${kind}`, { method: 'POST', body: fd })
    if (!res.ok) {
      toast.error(await errorMessage(res))
      return null
    }
    const { url } = (await res.json()) as { url: string }
    return url
  }

  async function onImage(e: Event) {
    const input = e.currentTarget as HTMLInputElement
    uploadingImage = true
    try {
      const url = await uploadFile(input.files?.[0], 'image')
      if (url) imageUrl = url
    } finally {
      uploadingImage = false
      input.value = ''
    }
  }

  async function onPdf(e: Event) {
    const input = e.currentTarget as HTMLInputElement
    uploadingPdf = true
    try {
      const url = await uploadFile(input.files?.[0], 'pdf')
      if (url) pdfUrl = url
    } finally {
      uploadingPdf = false
      input.value = ''
    }
  }
</script>

<svelte:head>
  <title>{subject || 'Campagne'} — Newsletter — {data.ludo.name}</title>
</svelte:head>

{#snippet payload()}
  <input type="hidden" name="subject" value={subject} />
  <input type="hidden" name="previewText" value={previewText} />
  <input type="hidden" name="content" value={contentJson} />
  <input type="hidden" name="targetTag" value={targetTag} />
{/snippet}

<main class="editor">
  <header class="head">
    <a class="back" href={`/${slug}/newsletter`}>
      <ArrowLeftIcon aria-hidden="true" />
      Campagnes
    </a>
    <StatusBadge
      status={campaign.status}
      labels={{ draft: 'Brouillon', sent: 'Envoyée' }}
      variantMap={{ draft: 'secondary', sent: 'success' }}
    />
  </header>

  {#if sent}
    <p class="banner banner-info">
      Cette campagne a été envoyée à {campaign.recipientCount} destinataire{campaign.recipientCount >
      1
        ? 's'
        : ''}{campaign.targetTag
        ? ` (segment « ${TAG_LABELS[campaign.targetTag as keyof typeof TAG_LABELS]} »)`
        : ''}. Elle n'est plus modifiable.
    </p>
  {/if}

  <div class="cols">
    <section class="form-col">
      <div class="card">
        <div class="field">
          <Label for="subject">Objet de l'email</Label>
          <Input
            id="subject"
            bind:value={subject}
            placeholder="Ex. Programme de printemps"
            disabled={sent}
          />
          <p class="hint counter" class:over={subject.length > SUBJECT_MAX}>
            {subject.length} / {SUBJECT_MAX} — au-delà, l'objet est souvent tronqué dans la boîte de réception.
          </p>
        </div>
        <div class="field">
          <Label for="preview">Texte d'aperçu</Label>
          <Input
            id="preview"
            bind:value={previewText}
            placeholder="Court extrait affiché après l'objet dans la boîte de réception"
            disabled={sent}
          />
          <p class="hint counter" class:over={previewText.length > PREVIEW_MAX}>
            {previewText.length} / {PREVIEW_MAX} — au-delà, le reste est masqué par la plupart des clients
            mail.
          </p>
        </div>
      </div>

      <div class="card">
        <h2>Contenu</h2>
        <div class="field">
          <Label for="title">Titre</Label>
          <Input
            id="title"
            bind:value={title}
            placeholder="Titre affiché en haut de l'email"
            disabled={sent}
          />
        </div>
        <div class="field">
          <Label for="body">Message</Label>
          <textarea
            id="body"
            bind:value={body}
            rows="8"
            placeholder="Votre message… Laissez une ligne vide entre les paragraphes."
            disabled={sent}
          ></textarea>
          <p class="hint">
            Astuce : <code>{'{{first_name}}'}</code> sera remplacé par le prénom du destinataire.
          </p>
        </div>

        <div class="field">
          <span class="field-label">Image (facultatif)</span>
          {#if imageUrl}
            <div class="media">
              <img src={imageUrl} alt="Aperçu" class="media-img" />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onclick={() => (imageUrl = '')}
                disabled={sent}
              >
                Retirer
              </Button>
            </div>
          {:else}
            <label class="upload" class:disabled={sent || uploadingImage}>
              <ImageIcon aria-hidden="true" />
              {uploadingImage ? 'Envoi…' : 'Ajouter une image'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onchange={onImage}
                disabled={sent || uploadingImage}
                hidden
              />
            </label>
          {/if}
        </div>

        <div class="grid-2">
          <div class="field">
            <Label for="cta-label">Bouton — texte</Label>
            <Input
              id="cta-label"
              bind:value={ctaLabel}
              placeholder="Ex. S'inscrire"
              disabled={sent}
            />
          </div>
          <div class="field">
            <Label for="cta-url">Bouton — lien</Label>
            <Input
              id="cta-url"
              type="url"
              bind:value={ctaUrl}
              placeholder="https://…"
              disabled={sent}
            />
          </div>
        </div>

        <div class="field">
          <span class="field-label">Document PDF (facultatif)</span>
          {#if pdfUrl}
            <div class="media">
              <a href={pdfUrl} target="_blank" rel="noopener" class="pdf-link">
                <FileTextIcon aria-hidden="true" /> Voir le PDF
              </a>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onclick={() => (pdfUrl = '')}
                disabled={sent}
              >
                Retirer
              </Button>
            </div>
            <label class="check">
              <input type="checkbox" bind:checked={pdfAsAttachment} disabled={sent} />
              Joindre le PDF en pièce jointe (sinon, simple lien de téléchargement)
            </label>
          {:else}
            <label class="upload" class:disabled={sent || uploadingPdf}>
              <FileTextIcon aria-hidden="true" />
              {uploadingPdf ? 'Envoi…' : 'Ajouter un PDF'}
              <input
                type="file"
                accept="application/pdf"
                onchange={onPdf}
                disabled={sent || uploadingPdf}
                hidden
              />
            </label>
          {/if}
        </div>
      </div>

      {#if !sent}
        <div class="card">
          <h2>Destinataires</h2>
          <div class="field">
            <Label for="target-tag">Segment ciblé</Label>
            <select id="target-tag" bind:value={targetTag}>
              <option value="">Tous les abonnés ({data.subscribedByTag.total})</option>
              {#each CONTACT_TAGS as t (t)}
                <option value={t}>{TAG_LABELS[t]} ({data.subscribedByTag[t] ?? 0})</option>
              {/each}
            </select>
            <p class="hint">
              {recipientCount} destinataire{recipientCount > 1 ? 's' : ''} abonné{recipientCount > 1
                ? 's'
                : ''} recevront cette campagne.
            </p>
          </div>
        </div>

        <div class="card">
          <h2>Tester</h2>
          <form
            method="POST"
            action="?/sendTest"
            class="test-row"
            use:enhance={toastEnhance({
              success: 'Email de test envoyé.',
              errorMode: 'toast',
              onPending: (p) => (testing = p),
            })}
          >
            {@render payload()}
            <Input
              name="testEmail"
              type="email"
              bind:value={testEmail}
              placeholder="votre@email.ch"
              required
            />
            <Button type="submit" variant="outline" disabled={testing}>
              {testing ? 'Envoi…' : 'Envoyer un test'}
            </Button>
          </form>
        </div>

        <div class="actions">
          <form
            method="POST"
            action="?/save"
            use:enhance={toastEnhance({
              success: 'Brouillon enregistré.',
              errorMode: 'toast',
              onPending: (p) => (saving = p),
            })}
          >
            {@render payload()}
            <Button type="submit" variant="outline" disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer le brouillon'}
            </Button>
          </form>

          <AlertDialog.Root>
            <AlertDialog.Trigger class={buttonVariants({ variant: 'default' })} disabled={sending}>
              Envoyer la campagne
            </AlertDialog.Trigger>
            <AlertDialog.Content>
              <AlertDialog.Header>
                <AlertDialog.Title
                  >Envoyer à {recipientCount} abonné{recipientCount > 1 ? 's' : ''} ?</AlertDialog.Title
                >
                <AlertDialog.Description>
                  L'email sera envoyé immédiatement {targetTag
                    ? `aux abonnés du segment « ${TAG_LABELS[targetTag as keyof typeof TAG_LABELS]} »`
                    : 'à tous les contacts abonnés'}. Cette action est irréversible.
                </AlertDialog.Description>
              </AlertDialog.Header>
              <form
                method="POST"
                action="?/send"
                use:enhance={toastEnhance({
                  errorMode: 'toast',
                  onPending: (p) => (sending = p),
                  onSuccess: (d) => {
                    const r = (d ?? {}) as { sent?: number; failed?: number }
                    const n = r.sent ?? 0
                    toast.success(
                      `Campagne envoyée à ${n} contact${n > 1 ? 's' : ''}.` +
                        (r.failed ? ` ${r.failed} échec(s).` : ''),
                    )
                  },
                })}
              >
                {@render payload()}
                <AlertDialog.Footer>
                  <AlertDialog.Cancel type="button">Annuler</AlertDialog.Cancel>
                  <button
                    type="submit"
                    class={buttonVariants({ variant: 'default' })}
                    disabled={recipientCount === 0}
                  >
                    Envoyer maintenant
                  </button>
                </AlertDialog.Footer>
              </form>
            </AlertDialog.Content>
          </AlertDialog.Root>
        </div>
      {/if}
    </section>

    <section class="preview-col">
      <div class="preview-sticky">
        <p class="preview-label">Boîte de réception</p>
        <InboxPreview sender={data.ludo.name} {subject} {previewText} color={data.ludo.color} />
        <p class="preview-label preview-label-mt">Aperçu</p>
        <iframe
          bind:this={previewEl}
          class="preview-frame"
          title="Aperçu de l'email"
          srcdoc={BLANK_DOC}
          onload={paintPreview}
        ></iframe>
      </div>
    </section>
  </div>
</main>

<style>
  .editor {
    max-width: var(--max-content);
    margin: 0 auto;
    padding: var(--space-6) var(--space-6) var(--space-10);
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    margin-bottom: var(--space-4);
  }
  .back {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--text-muted);
    text-decoration: none;
    font-size: var(--text-small);
    font-weight: var(--weight-medium);
  }
  .back:hover {
    color: var(--text-main);
  }
  .back :global(svg) {
    width: 1rem;
    height: 1rem;
  }
  .banner {
    margin: 0 0 var(--space-4);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-sm);
    font-size: var(--text-small);
  }
  .banner-info {
    background: var(--bg-card);
    border: 1px solid var(--border);
    color: var(--text-muted);
  }
  .cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-6);
    align-items: start;
  }
  .form-col {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--space-5);
  }
  h2 {
    color: var(--text-main);
    font-size: var(--text-h3, var(--text-body));
    font-weight: var(--weight-semibold);
    margin: 0 0 var(--space-4);
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-bottom: var(--space-4);
  }
  .field:last-child {
    margin-bottom: 0;
  }
  .field-label {
    color: var(--text-main);
    font-size: var(--text-small);
    font-weight: var(--weight-medium);
  }
  .grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
  }
  textarea {
    width: 100%;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-input, var(--bg-card));
    color: var(--text-main);
    font-family: inherit;
    font-size: var(--text-body);
    resize: vertical;
  }
  .hint {
    color: var(--text-muted);
    font-size: var(--text-small);
    margin: 0;
  }
  .hint code {
    background: var(--bg-base);
    padding: 0 var(--space-1);
    border-radius: 3px;
  }
  .counter.over {
    color: var(--warning);
  }
  .upload {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-4);
    border: 1px dashed var(--border);
    border-radius: var(--radius-sm);
    color: var(--text-muted);
    font-size: var(--text-small);
    cursor: pointer;
    width: fit-content;
  }
  .upload:hover {
    background: var(--bg-hover);
  }
  .upload.disabled {
    opacity: 0.5;
    pointer-events: none;
  }
  .upload :global(svg),
  .pdf-link :global(svg) {
    width: 1rem;
    height: 1rem;
  }
  .media {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
  .media-img {
    max-height: 80px;
    max-width: 160px;
    object-fit: contain;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
  }
  .pdf-link {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--ludo-color, var(--primary));
    font-size: var(--text-small);
  }
  .check {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-top: var(--space-2);
    font-size: var(--text-small);
    color: var(--text-muted);
  }
  .test-row {
    display: flex;
    gap: var(--space-2);
    align-items: center;
  }
  .test-row :global(input) {
    flex: 1;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }
  .preview-sticky {
    position: sticky;
    top: var(--space-6);
  }
  .preview-label {
    color: var(--text-muted);
    font-size: var(--text-label);
    font-weight: var(--weight-bold);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0 0 var(--space-2);
  }
  .preview-label-mt {
    margin-top: var(--space-4);
  }
  .preview-frame {
    width: 100%;
    height: 70vh;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: #f0f0f0;
  }
  @media (max-width: 900px) {
    .cols {
      grid-template-columns: 1fr;
    }
    .preview-frame {
      height: 50vh;
    }
  }
</style>
