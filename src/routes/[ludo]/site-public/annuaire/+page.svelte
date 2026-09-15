<script lang="ts">
  import { enhance } from '$app/forms'
  import { page } from '$app/state'
  import DirectoryDialog, {
    type EditableDirectoryEntry,
  } from '$lib/components/public-site/DirectoryDialog.svelte'
  import { Badge } from '$lib/components/ui/badge/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import { EmptyState } from '$lib/components/ui/empty-state/index.js'
  import { toastEnhance } from '$lib/utils/enhance.js'
  import MapPinnedIcon from '@lucide/svelte/icons/map-pinned'
  let { data } = $props()
  const selectedId = $derived(page.url.searchParams.get('item'))
  let open = $state(false),
    editing = $state<EditableDirectoryEntry | null>(null),
    pending = $state<string | null>(null)
  function create() {
    editing = null
    open = true
  }
  function edit(x: EditableDirectoryEntry) {
    editing = x
    open = true
  }
</script>

<svelte:head><title>Annuaire genevois · {data.ludo.name}</title></svelte:head>
<main>
  <header>
    <div>
      <p>Site public</p>
      <h1>Annuaire genevois</h1>
      <span>Gérez les organisations et leur ordre d’affichage.</span>
    </div>
    <Button onclick={create}>Nouvelle entrée</Button>
  </header>
  {#if page.form && 'error' in page.form && page.form.error}<p class="error">
      {page.form.error}
    </p>{/if}{#if !data.entries.length}<EmptyState
      icon={MapPinnedIcon}
      title="Annuaire vide"
      description="Créez une première entrée."
      >{#snippet action()}<Button onclick={create}>Nouvelle entrée</Button>{/snippet}</EmptyState
    >{:else}<div class="list">
      {#each data.entries as item (item.id)}<article class:compact={selectedId !== item.id}>
          <div class="head">
            <h2><a href={selectedId === item.id ? '?' : `?item=${item.id}`}>{item.name}</a></h2>
            <p>{item.address || ''} {item.postalCode || ''} {item.city} · ordre {item.sortOrder}</p>
          </div>
          <div class="badges">
            {#if item.status === 'published'}<Badge variant="success">Publiée</Badge
              >{:else if item.status === 'hidden'}<Badge variant="secondary">Masquée</Badge
              >{:else}<Badge variant="outline">Brouillon</Badge>{/if}
          </div>
          <footer>
            <Button size="sm" variant="outline" onclick={() => edit(item)}>Modifier</Button>
            <form
              method="POST"
              action="?/publication"
              use:enhance={toastEnhance({
                success: item.status === 'published' ? 'Entrée masquée.' : 'Entrée publiée.',
                onPending: (v) => (pending = v ? item.id : null),
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
              /><Button type="submit" size="sm" disabled={pending === item.id}
                >{item.status === 'published' ? 'Masquer' : 'Publier'}</Button
              >
            </form>
            <form
                method="POST"
                action="?/delete"
                onsubmit={(event) => {
                  if (!confirm('Supprimer définitivement cette entrée de l’annuaire ?'))
                    event.preventDefault()
                }}
                use:enhance={toastEnhance({ success: 'Entrée supprimée.' })}
              >
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="revision" value={item.revision} />
                <Button type="submit" size="sm" variant="destructive">Supprimer</Button>
            </form>
          </footer>
        </article>{/each}
    </div>{/if}<DirectoryDialog bind:open entry={editing} />
</main>

<style>
  main {
    max-width: var(--max-content);
    margin: auto;
    padding: var(--space-8) var(--space-6);
  }
  header,
  article,
  footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
  }
  header {
    margin-bottom: var(--space-6);
  }
  h1,
  h2,
  p {
    margin: 0;
  }
  .list {
    display: grid;
    gap: var(--space-3);
  }
  article {
    padding: var(--space-4);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--bg-card);
  }
  footer {
    justify-content: flex-end;
  }
  .error {
    padding: var(--space-3);
    background: var(--danger-light);
    color: var(--danger);
  }
  @media (max-width: 640px) {
    header,
    article {
      align-items: stretch;
      flex-direction: column;
    }
  }
  article.compact footer {
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
