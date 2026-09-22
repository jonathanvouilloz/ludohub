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
  const selectedId = $derived(page.url.searchParams.get('item'))
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
  <section class="categories" aria-labelledby="categories-title">
    <h2 id="categories-title">Catégories</h2>
    <div class="category-list">
      {#each data.categories as category (category.id)}
        <form
          method="POST"
          action="?/updateCategory"
          use:enhance={toastEnhance({ success: 'Catégorie mise à jour.' })}
        >
          <input type="hidden" name="id" value={category.id} />
          <input
            name="name"
            value={category.name}
            maxlength="100"
            aria-label="Nom de la catégorie"
          />
          <input
            name="sortOrder"
            type="number"
            min="0"
            value={category.sortOrder}
            aria-label={`Ordre de ${category.name}`}
            title="Ordre d’affichage"
          />
          <Button type="submit" size="sm" variant="outline">Enregistrer</Button>
        </form>
        <form
          method="POST"
          action="?/updateCategory"
          use:enhance={toastEnhance({ success: 'Catégorie mise à jour.' })}
        >
          <input type="hidden" name="id" value={category.id} />
          <input type="hidden" name="isActive" value={category.isActive ? 'false' : 'true'} />
          <Button type="submit" size="sm" variant="outline"
            >{category.isActive ? 'Désactiver' : 'Réactiver'}</Button
          >
        </form>
      {/each}
      <form
        method="POST"
        action="?/createCategory"
        use:enhance={toastEnhance({ success: 'Catégorie ajoutée.' })}
      >
        <input
          name="name"
          maxlength="100"
          required
          placeholder="Nouvelle catégorie"
          aria-label="Nouvelle catégorie"
        />
        <Button type="submit" size="sm" variant="outline">Ajouter</Button>
      </form>
    </div>
  </section>
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
          class:compact={selectedId !== item.id}
        >
          <div class="card-head">
            <div>
              <h2>
                <a href={selectedId === item.id ? '?' : `?item=${item.id}`}>{item.question}</a>
              </h2>
              <p class="meta">
                {item.category.name}
              </p>
            </div>
            <div class="badges">
              {#if item.status === 'published'}<Badge variant="success">Publiée</Badge
                >{:else if item.status === 'hidden'}<Badge variant="secondary">Masquée</Badge
                >{:else}<Badge variant="outline">Brouillon</Badge>{/if}
            </div>
          </div>
          <p class="answer">{item.answerText}</p>
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
                disabled={pendingId === item.id}
                >{item.status === 'published' ? 'Masquer' : 'Publier'}</Button
              >
            </form>
            <form
              method="POST"
              action="?/delete"
              onsubmit={(event) => {
                if (!confirm('Supprimer définitivement cette question ?')) event.preventDefault()
              }}
              use:enhance={toastEnhance({ success: 'Question supprimée.' })}
            >
              <input type="hidden" name="id" value={item.id} /><input
                type="hidden"
                name="revision"
                value={item.revision}
              /><Button type="submit" size="sm" variant="destructive">Supprimer</Button>
            </form>
          </footer>
        </article>{/each}
    </div>
  {/if}
  <FaqDialog bind:open={dialogOpen} faq={editing} categories={data.categories} />
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
  .categories {
    display: grid;
    gap: var(--space-3);
    margin: 0 0 var(--space-6);
    padding: var(--space-4);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--bg-card);
  }
  .category-list,
  .category-list form {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
  }
  .category-list input {
    min-height: 36px;
    padding: var(--space-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-card);
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
  .error {
    padding: var(--space-3);
    border-radius: var(--radius-sm);
    font-size: var(--text-small);
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
  .compact > :not(.card-head) {
    display: none;
  }
  h2 a {
    color: var(--text-main);
    text-decoration: none;
  }
  h2 a:hover {
    color: var(--primary);
    text-decoration: underline;
  }
</style>
