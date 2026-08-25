<script lang="ts" module>
  export type EditorialAsset = {
    id: string
    kind: 'support_image' | 'pdf_attachment'
    url: string
    downloadUrl: string | null
    fileName: string | null
    sizeBytes: number
    alt: string | null
    caption: string | null
    credit: string | null
  }
</script>

<script lang="ts">
  import { enhance } from '$app/forms'
  import { Button } from '$lib/components/ui/button/index.js'
  import { compressEditorialImageFormData } from '$lib/media/editorial-image.js'
  import { toastEnhance } from '$lib/utils/enhance.js'

  let {
    ownerId,
    revision,
    assets,
  }: { ownerId: string; revision: number; assets: EditorialAsset[] } = $props()

  const support = $derived(assets.find((asset) => asset.kind === 'support_image') ?? null)
  const attachments = $derived(assets.filter((asset) => asset.kind === 'pdf_attachment'))
  let pending = $state<'support' | 'pdf' | string | null>(null)

  function sizeLabel(bytes: number) {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Kio`
    return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} Mio`
  }
</script>

<section class="assets-editor" aria-label="Médias complémentaires">
  <div class="section-heading">
    <div>
      <h3>Image dans la publication</h3>
      <p>Une image d’appoint, affichée dans le contenu après le premier paragraphe.</p>
    </div>
  </div>

  {#if support}
    <figure class="support-preview">
      <img src={support.url} alt={support.alt ?? ''} />
      {#if support.caption || support.credit}
        <figcaption>
          {support.caption ?? ''}{support.credit ? ` — ${support.credit}` : ''}
        </figcaption>
      {/if}
    </figure>
  {/if}

  <div class="media-actions">
    <form
      method="POST"
      action="?/uploadSupportImage"
      enctype="multipart/form-data"
      use:enhance={toastEnhance({
        success: support ? 'Image d’appoint remplacée.' : 'Image d’appoint ajoutée.',
        prepare: (formData) => compressEditorialImageFormData(formData, 'content'),
        onPending: (value) => (pending = value ? 'support' : null),
      })}
    >
      <input type="hidden" name="id" value={ownerId} />
      <input type="hidden" name="revision" value={revision} />
      <label>
        <span>Image JPEG, PNG ou WebP</span>
        <input type="file" name="file" accept="image/jpeg,image/png,image/webp" required />
        <small>Redimensionnée à 1 600 px et compressée avant l’envoi.</small>
      </label>
      <label>
        <span>Texte alternatif</span>
        <input type="text" name="alt" value={support?.alt ?? ''} maxlength="300" required />
      </label>
      <label>
        <span>Légende facultative</span>
        <input type="text" name="caption" value={support?.caption ?? ''} maxlength="500" />
      </label>
      <label>
        <span>Crédit facultatif</span>
        <input type="text" name="credit" value={support?.credit ?? ''} maxlength="200" />
      </label>
      <Button type="submit" size="sm" disabled={pending === 'support'}>
        {pending === 'support' ? 'Optimisation et envoi…' : support ? 'Remplacer' : 'Ajouter'}
      </Button>
    </form>

    {#if support}
      <form
        method="POST"
        action="?/deleteAsset"
        use:enhance={toastEnhance({
          success: 'Image d’appoint supprimée.',
          onPending: (value) => (pending = value ? support.id : null),
        })}
      >
        <input type="hidden" name="id" value={ownerId} />
        <input type="hidden" name="revision" value={revision} />
        <input type="hidden" name="assetId" value={support.id} />
        <Button type="submit" size="sm" variant="outline" disabled={pending === support.id}>
          Retirer l’image d’appoint
        </Button>
      </form>
    {/if}
  </div>

  <div class="attachments-heading">
    <div>
      <h3>Documents PDF</h3>
      <p>Jusqu’à cinq documents publics de 15 Mio maximum.</p>
    </div>
    <span>{attachments.length}/5</span>
  </div>

  {#if attachments.length}
    <ul class="attachments">
      {#each attachments as asset (asset.id)}
        <li>
          <div>
            <strong>{asset.caption}</strong>
            <small>{asset.fileName} · {sizeLabel(asset.sizeBytes)}</small>
          </div>
          <div class="attachment-actions">
            <a href={asset.url} target="_blank" rel="noopener noreferrer">Ouvrir</a>
            {#if asset.downloadUrl}
              <a href={asset.downloadUrl}>Télécharger</a>
            {/if}
            <form
              method="POST"
              action="?/deleteAsset"
              use:enhance={toastEnhance({
                success: 'PDF supprimé.',
                onPending: (value) => (pending = value ? asset.id : null),
              })}
            >
              <input type="hidden" name="id" value={ownerId} />
              <input type="hidden" name="revision" value={revision} />
              <input type="hidden" name="assetId" value={asset.id} />
              <Button type="submit" size="sm" variant="outline" disabled={pending === asset.id}>
                Supprimer
              </Button>
            </form>
          </div>
        </li>
      {/each}
    </ul>
  {/if}

  {#if attachments.length < 5}
    <form
      class="pdf-form"
      method="POST"
      action="?/uploadAttachment"
      enctype="multipart/form-data"
      use:enhance={toastEnhance({
        success: 'PDF ajouté.',
        onPending: (value) => (pending = value ? 'pdf' : null),
      })}
    >
      <input type="hidden" name="id" value={ownerId} />
      <input type="hidden" name="revision" value={revision} />
      <label>
        <span>Titre du document</span>
        <input type="text" name="title" maxlength="500" placeholder="Programme complet" required />
      </label>
      <label>
        <span>Fichier PDF</span>
        <input type="file" name="file" accept="application/pdf" required />
      </label>
      <Button type="submit" size="sm" disabled={pending === 'pdf'}>
        {pending === 'pdf' ? 'Envoi…' : 'Ajouter le PDF'}
      </Button>
    </form>
  {/if}
</section>

<style>
  .assets-editor {
    display: grid;
    gap: var(--space-4);
    padding-top: var(--space-4);
    border-top: 1px solid var(--border);
  }
  .section-heading,
  .attachments-heading,
  .attachments li,
  .attachment-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }
  h3,
  p {
    margin: 0;
  }
  h3 {
    font-size: var(--text-body);
  }
  p,
  small {
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  .support-preview {
    max-width: 560px;
    margin: 0;
  }
  .support-preview img {
    display: block;
    width: 100%;
    max-height: 320px;
    border-radius: var(--radius-md);
    object-fit: cover;
  }
  figcaption {
    padding-top: var(--space-2);
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  .media-actions,
  .media-actions > form:first-child,
  .pdf-form {
    display: flex;
    align-items: flex-end;
    flex-wrap: wrap;
    gap: var(--space-3);
  }
  .media-actions > form:first-child {
    flex: 1 1 100%;
  }
  label {
    display: grid;
    flex: 1 1 180px;
    gap: var(--space-1);
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  input {
    width: 100%;
    min-height: 40px;
    padding: var(--space-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-card);
    color: var(--text-main);
  }
  .attachments {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .attachments li {
    padding: var(--space-3);
    border-radius: var(--radius-md);
    background: var(--bg-muted);
  }
  .attachments li > div:first-child {
    display: grid;
    gap: var(--space-1);
  }
  .attachment-actions a {
    color: var(--text-main);
    font-size: var(--text-small);
    font-weight: var(--weight-semibold);
  }
  @media (max-width: 720px) {
    .media-actions,
    .media-actions > form:first-child,
    .pdf-form,
    .attachments li,
    .attachment-actions {
      align-items: stretch;
      flex-direction: column;
    }
    .media-actions :global(button),
    .pdf-form :global(button) {
      width: 100%;
    }
  }
</style>
