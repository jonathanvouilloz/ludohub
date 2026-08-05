<script lang="ts">
  import { enhance } from '$app/forms'
  import { page } from '$app/state'
  import DocumentDialog, {
    type EditableDocument,
  } from '$lib/components/public-site/DocumentDialog.svelte'
  import { Badge } from '$lib/components/ui/badge/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import { EmptyState } from '$lib/components/ui/empty-state/index.js'
  import { toastEnhance } from '$lib/utils/enhance.js'
  import FileTextIcon from '@lucide/svelte/icons/file-text'
  import PencilIcon from '@lucide/svelte/icons/pencil'

  let { data } = $props()
  let dialogOpen = $state(false)
  let editing = $state<EditableDocument | null>(null)
  let pendingId = $state<string | null>(null)
  let filePendingId = $state<string | null>(null)
  function openCreate() {
    editing = null
    dialogOpen = true
  }
  function openEdit(document: EditableDocument) {
    editing = document
    dialogOpen = true
  }
  function inactiveTargets(document: EditableDocument) {
    return document.targets.some((target) => !target.site.isActive)
  }
  function targetLabel(document: EditableDocument) {
    return document.targets.length
      ? document.targets
          .map((target) => `${target.site.name}${target.site.isActive ? '' : ' (inactif)'}`)
          .join(', ')
      : 'Tous les lieux actifs'
  }
  const kindLabels = {
    mission: 'Mission',
    statutes: 'Statuts',
    annual_report: 'Rapport annuel',
    other: 'Autre',
  } as const
</script>

<svelte:head><title>Documents · {data.ludo.name}</title></svelte:head>
<main class="page-shell">
  <header>
    <div>
      <p class="eyebrow">Site public</p>
      <h1>Documents</h1>
      <p class="intro">Publiez les textes institutionnels et leurs fichiers PDF.</p>
    </div>
    <Button onclick={openCreate}>Nouveau document</Button>
  </header>
  {#if page.form && 'error' in page.form && page.form.error}<p class="error" role="alert">
      {page.form.error}
    </p>{/if}
  {#if data.documents.length === 0}
    <EmptyState
      icon={FileTextIcon}
      title="Aucun document"
      description="Créez une première fiche en brouillon."
      >{#snippet action()}<Button onclick={openCreate}>Nouveau document</Button
        >{/snippet}</EmptyState
    >
  {:else}<div class="list">
      {#each data.documents as item (item.id)}<article
          class="card"
          class:muted={item.status !== 'published'}
        >
          <div class="card-head">
            <div>
              <h2>{item.title}</h2>
              <p class="meta">
                {kindLabels[item.kind]}{item.year ? ` · ${item.year}` : ''} · {targetLabel(item)}
              </p>
            </div>
            <div class="badges">
              {#if item.status === 'published'}<Badge variant="success">Publié</Badge
                >{:else if item.status === 'hidden'}<Badge variant="secondary">Masqué</Badge
                >{:else}<Badge variant="outline">Brouillon</Badge>{/if}{#if item.pdfUrl}<Badge
                  variant="outline">PDF</Badge
                >{/if}{#if inactiveTargets(item)}<Badge variant="warning">Cible inactive</Badge
                >{/if}
            </div>
          </div>
          <p class="summary">{item.summary}</p>
          {#if item.pdfUrl}<a class="file-link" href={item.pdfUrl} target="_blank" rel="noreferrer"
              >Consulter {item.pdfFileName || 'le PDF'}</a
            >{/if}
          {#if inactiveTargets(item)}<p class="warning" role="alert">
              Ce document cible un lieu inactif. Corrigez le ciblage avant publication.
            </p>{/if}
          <footer>
            <Button variant="outline" size="sm" onclick={() => openEdit(item)}
              ><PencilIcon size={16} aria-hidden="true" /> Modifier</Button
            >
            <form
              method="POST"
              action="?/publication"
              use:enhance={toastEnhance({
                success: item.status === 'published' ? 'Document masqué.' : 'Document publié.',
                onPending: (value) => (pendingId = value ? item.id : null),
              })}
            >
              <input type="hidden" name="id" value={item.id} /><input
                type="hidden"
                name="revision"
                value={item.revision}
              /><input
                type="hidden"
                name="status"
                value={item.status === 'published' ? 'hidden' : 'published'}
              /><Button
                type="submit"
                size="sm"
                variant={item.status === 'published' ? 'outline' : 'default'}
                disabled={pendingId === item.id ||
                  (item.status !== 'published' && inactiveTargets(item))}
                >{item.status === 'published' ? 'Masquer' : 'Publier'}</Button
              >
            </form>
            {#if item.status === 'draft'}<form
                method="POST"
                action="?/delete"
                onsubmit={(event) => {
                  if (!confirm('Supprimer définitivement ce brouillon ?')) event.preventDefault()
                }}
                use:enhance={toastEnhance({ success: 'Brouillon supprimé.' })}
              >
                <input type="hidden" name="id" value={item.id} /><input
                  type="hidden"
                  name="revision"
                  value={item.revision}
                /><Button type="submit" size="sm" variant="destructive">Supprimer</Button>
              </form>{/if}
          </footer>
          <section class="file-editor" aria-label={`PDF de ${item.title}`}>
            <form
              method="POST"
              action="?/uploadFile"
              enctype="multipart/form-data"
              use:enhance={toastEnhance({
                success: item.pdfUrl ? 'PDF remplacé.' : 'PDF ajouté.',
                onPending: (value) => (filePendingId = value ? item.id : null),
              })}
            >
              <input type="hidden" name="id" value={item.id} /><input
                type="hidden"
                name="revision"
                value={item.revision}
              /><label
                ><span>Fichier PDF · 15 Mio maximum</span><input
                  type="file"
                  name="file"
                  accept="application/pdf"
                  required
                /></label
              ><Button type="submit" size="sm" disabled={filePendingId === item.id}
                >{item.pdfUrl ? 'Remplacer le PDF' : 'Ajouter le PDF'}</Button
              >
            </form>
            {#if item.pdfUrl}<form
                method="POST"
                action="?/removeFile"
                use:enhance={toastEnhance({
                  success: 'PDF supprimé.',
                  onPending: (value) => (filePendingId = value ? item.id : null),
                })}
              >
                <input type="hidden" name="id" value={item.id} /><input
                  type="hidden"
                  name="revision"
                  value={item.revision}
                /><Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  disabled={filePendingId === item.id}>Supprimer le PDF</Button
                >
              </form>{/if}
          </section>
        </article>{/each}
    </div>{/if}
  <DocumentDialog bind:open={dialogOpen} document={editing} sites={data.sites} />
</main>

<style>
  .page-shell {
    max-width: var(--max-content);
    margin: 0 auto;
    padding: var(--space-8) var(--space-6);
  }
  header,
  .card-head,
  footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
  }
  header {
    align-items: flex-end;
    margin-bottom: var(--space-6);
  }
  h1,
  h2,
  p {
    margin: 0;
  }
  .eyebrow,
  .intro,
  .meta {
    color: var(--text-muted);
  }
  .eyebrow {
    font-size: var(--text-label);
    font-weight: var(--weight-bold);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  h1 {
    margin-top: var(--space-1);
    font-size: var(--text-h1);
  }
  h2 {
    font-size: var(--text-card-title);
  }
  .meta {
    margin-top: var(--space-1);
    font-size: var(--text-small);
  }
  .list {
    display: grid;
    gap: var(--space-4);
  }
  .card {
    display: grid;
    gap: var(--space-4);
    padding: var(--space-5);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--bg-card);
  }
  .card.muted {
    border-style: dashed;
  }
  .badges {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--space-2);
  }
  .summary {
    line-height: 1.6;
  }
  .file-link {
    color: var(--ludo-color);
    font-weight: var(--weight-semibold);
  }
  footer,
  .file-editor {
    justify-content: flex-end;
    padding-top: var(--space-3);
    border-top: 1px solid var(--border);
  }
  .file-editor,
  .file-editor form {
    display: flex;
    align-items: flex-end;
    gap: var(--space-3);
  }
  .file-editor form:first-child {
    flex: 1;
  }
  .file-editor label {
    display: grid;
    gap: var(--space-1);
    flex: 1;
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  .file-editor input {
    width: 100%;
    min-height: 40px;
    padding: var(--space-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
  }
  .warning,
  .error {
    padding: var(--space-3);
    border-radius: var(--radius-sm);
    font-size: var(--text-small);
  }
  .warning {
    background: var(--warning-light);
  }
  .error {
    margin-bottom: var(--space-4);
    background: var(--danger-light);
    color: var(--danger);
  }
  @media (max-width: 640px) {
    .page-shell {
      padding: var(--space-6) var(--space-4);
    }
    header,
    .card-head,
    .file-editor,
    .file-editor form {
      align-items: stretch;
      flex-direction: column;
    }
    .badges {
      justify-content: flex-start;
    }
  }
</style>
