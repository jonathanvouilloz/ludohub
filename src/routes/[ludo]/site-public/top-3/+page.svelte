<script lang="ts">
  import { enhance } from '$app/forms'
  import { page } from '$app/state'
  import TopThreeDialog, {
    type EditableTopThree,
  } from '$lib/components/public-site/TopThreeDialog.svelte'
  import { Badge } from '$lib/components/ui/badge/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import { EmptyState } from '$lib/components/ui/empty-state/index.js'
  import { toastEnhance } from '$lib/utils/enhance.js'
  import ListOrderedIcon from '@lucide/svelte/icons/list-ordered'
  import PencilIcon from '@lucide/svelte/icons/pencil'

  let { data } = $props()
  let dialogOpen = $state(false)
  let editing = $state<EditableTopThree | null>(null)
  let pendingId = $state<string | null>(null)

  function openCreate() {
    editing = null
    dialogOpen = true
  }
  function openEdit(topThree: EditableTopThree) {
    editing = topThree
    dialogOpen = true
  }
  function inactiveTargets(topThree: EditableTopThree) {
    return topThree.targets.some((target) => !target.site.isActive)
  }
  function targetLabel(topThree: EditableTopThree) {
    if (topThree.targets.length === 0) return 'Tous les lieux actifs'
    return topThree.targets
      .map((target) => `${target.site.name}${target.site.isActive ? '' : ' (inactif)'}`)
      .join(', ')
  }
</script>

<svelte:head><title>Top 3 · {data.ludo.name}</title></svelte:head>

<main class="top-three-page">
  <header>
    <div>
      <p class="eyebrow">Site public</p>
      <h1>Top 3</h1>
      <p class="intro">
        Composez des sélections éditoriales de trois jeux autour d’un thème libre.
      </p>
    </div>
    <Button onclick={openCreate}>Nouveau Top 3</Button>
  </header>

  {#if page.form && 'error' in page.form && page.form.error}<p class="error" role="alert">
      {page.form.error}
    </p>{/if}

  {#if data.topThrees.length === 0}
    <EmptyState
      icon={ListOrderedIcon}
      title="Aucun Top 3"
      description="Créez une première sélection de trois jeux."
    >
      {#snippet action()}<Button onclick={openCreate}>Nouveau Top 3</Button>{/snippet}
    </EmptyState>
  {:else}
    <div class="list">
      {#each data.topThrees as item (item.id)}
        <article class="card" class:muted={item.status !== 'published'}>
          <div class="card-head">
            <div>
              <h2>{item.theme}</h2>
              <p class="targets">/{item.slug} · {targetLabel(item)}</p>
            </div>
            <div class="badges">
              {#if item.status === 'published'}<Badge variant="success">Publié</Badge>
              {:else if item.status === 'hidden'}<Badge variant="secondary">Masqué</Badge>
              {:else}<Badge variant="outline">Brouillon</Badge>{/if}
              {#if inactiveTargets(item)}<Badge variant="warning">Cible inactive</Badge>{/if}
            </div>
          </div>
          <ol>
            {#each item.games as game, index (index)}
              <li>
                <strong>{game.name}</strong>
                <p>{game.description}</p>
              </li>
            {/each}
          </ol>
          {#if inactiveTargets(item)}<p class="warning" role="alert">
              Ce Top 3 cible un lieu inactif. Corrigez le ciblage avant de publier.
            </p>{/if}
          <footer>
            <Button variant="outline" size="sm" onclick={() => openEdit(item)}
              ><PencilIcon size={16} aria-hidden="true" /> Modifier</Button
            >
            <form
              method="POST"
              action="?/publication"
              use:enhance={toastEnhance({
                success: item.status === 'published' ? 'Top 3 masqué.' : 'Top 3 publié.',
                onPending: (value) => (pendingId = value ? item.id : null),
              })}
            >
              <input type="hidden" name="id" value={item.id} /><input
                type="hidden"
                name="revision"
                value={item.revision}
              />
              <input
                type="hidden"
                name="status"
                value={item.status === 'published' ? 'hidden' : 'published'}
              />
              <Button
                type="submit"
                size="sm"
                variant={item.status === 'published' ? 'outline' : 'default'}
                disabled={pendingId === item.id ||
                  (item.status !== 'published' && inactiveTargets(item))}
              >
                {pendingId === item.id
                  ? 'Enregistrement…'
                  : item.status === 'published'
                    ? 'Masquer'
                    : 'Publier'}
              </Button>
            </form>
            {#if item.status === 'draft'}
              <form
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
                />
                <Button type="submit" size="sm" variant="destructive">Supprimer</Button>
              </form>
            {/if}
          </footer>
        </article>
      {/each}
    </div>
  {/if}
  <TopThreeDialog bind:open={dialogOpen} topThree={editing} sites={data.sites} />
</main>

<style>
  .top-three-page {
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
  .targets {
    color: var(--text-muted);
  }
  .eyebrow {
    font-size: var(--text-label);
    font-weight: var(--weight-bold);
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  h1 {
    margin-top: var(--space-1);
    font-size: var(--text-h1);
  }
  h2 {
    font-size: var(--text-card-title);
  }
  .targets {
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
  ol {
    display: grid;
    gap: var(--space-3);
    margin: 0;
    padding-left: var(--space-6);
  }
  li p {
    margin-top: var(--space-1);
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
    .top-three-page {
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
    header :global(button) {
      width: 100%;
    }
  }
</style>
