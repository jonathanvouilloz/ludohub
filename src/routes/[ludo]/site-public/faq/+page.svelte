<script lang="ts">
  import { enhance } from '$app/forms'
  import { page } from '$app/state'
  import FaqDialog, { type EditableFaq } from '$lib/components/public-site/FaqDialog.svelte'
  import { Badge } from '$lib/components/ui/badge/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import { EmptyState } from '$lib/components/ui/empty-state/index.js'
  import { toastEnhance } from '$lib/utils/enhance.js'
  import CircleHelpIcon from '@lucide/svelte/icons/circle-help'
  import PencilIcon from '@lucide/svelte/icons/pencil'

  let { data } = $props()
  let dialogOpen = $state(false)
  let editing = $state<EditableFaq | null>(null)
  let pendingId = $state<string | null>(null)
  function openCreate() {
    editing = null
    dialogOpen = true
  }
  function openEdit(faq: EditableFaq) {
    editing = faq
    dialogOpen = true
  }
  function inactiveTargets(faq: EditableFaq) {
    return faq.targets.some((target) => !target.site.isActive)
  }
  function targetLabel(faq: EditableFaq) {
    return faq.targets.length
      ? faq.targets
          .map((target) => `${target.site.name}${target.site.isActive ? '' : ' (inactif)'}`)
          .join(', ')
      : 'Tous les lieux actifs'
  }
</script>

<svelte:head><title>FAQ · {data.ludo.name}</title></svelte:head>
<main class="page-shell">
  <header>
    <div>
      <p class="eyebrow">Site public</p>
      <h1>FAQ</h1>
      <p class="intro">Organisez les réponses aux questions fréquentes.</p>
    </div>
    <Button onclick={openCreate}>Nouvelle question</Button>
  </header>
  {#if page.form && 'error' in page.form && page.form.error}<p class="error" role="alert">
      {page.form.error}
    </p>{/if}
  {#if data.faqs.length === 0}
    <EmptyState
      icon={CircleHelpIcon}
      title="Aucune question"
      description="Créez une première réponse en brouillon."
      >{#snippet action()}<Button onclick={openCreate}>Nouvelle question</Button
        >{/snippet}</EmptyState
    >
  {:else}
    <div class="list">
      {#each data.faqs as item (item.id)}<article
          class="card"
          class:muted={item.status !== 'published'}
        >
          <div class="card-head">
            <div>
              <h2>{item.question}</h2>
              <p class="meta">
                {item.category || 'Sans catégorie'} · ordre {item.sortOrder} · {targetLabel(item)}
              </p>
            </div>
            <div class="badges">
              {#if item.status === 'published'}<Badge variant="success">Publiée</Badge
                >{:else if item.status === 'hidden'}<Badge variant="secondary">Masquée</Badge
                >{:else}<Badge variant="outline">Brouillon</Badge
                >{/if}{#if inactiveTargets(item)}<Badge variant="warning">Cible inactive</Badge
                >{/if}
            </div>
          </div>
          <p class="answer">{item.answerMarkdown}</p>
          {#if inactiveTargets(item)}<p class="warning" role="alert">
              Cette question cible un lieu inactif. Corrigez le ciblage avant publication.
            </p>{/if}
          <footer>
            <Button variant="outline" size="sm" onclick={() => openEdit(item)}
              ><PencilIcon size={16} aria-hidden="true" /> Modifier</Button
            >
            <form
              method="POST"
              action="?/publication"
              use:enhance={toastEnhance({
                success: item.status === 'published' ? 'Question masquée.' : 'Question publiée.',
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
        </article>{/each}
    </div>
  {/if}
  <FaqDialog bind:open={dialogOpen} faq={editing} sites={data.sites} />
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
  .answer {
    max-height: 7.5em;
    overflow: hidden;
    white-space: pre-wrap;
    color: var(--text-muted);
    line-height: 1.5;
  }
  footer {
    justify-content: flex-end;
    padding-top: var(--space-3);
    border-top: 1px solid var(--border);
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
    .card-head {
      align-items: stretch;
      flex-direction: column;
    }
    .badges {
      justify-content: flex-start;
    }
  }
</style>
